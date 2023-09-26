import { Address, Cell, Dictionary, OpenedContract, Transaction } from '@ton/core';
import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { getSecureRandomBytes, keyPairFromSecretKey, keyPairFromSeed } from '@ton/crypto';
import { MasterCounter } from './MasterCounter';
import { NetworkProvider, UIProvider, sleep } from '@ton/blueprint';
import { TonClient4 } from '@ton/ton';

const HISTORY_GAP = 60;

export const auto = path.join(__dirname, '..', 'contracts', 'auto');

export async function setMasterCounter(masterCounter: Address) {
    await mkdir(auto, { recursive: true });
    await writeFile(
        path.join(auto, `master-counter-address.fc`),
        `const slice master_counter_address = "${masterCounter.toString()}"a;`
    );
}

const decimalCount = 9;
const decimal = pow10(decimalCount);

function pow10(n: number): bigint {
    let v = 1n;
    for (let i = 0; i < n; i++) {
        v *= 10n;
    }
    return v;
}

function formatCoinsPure(value: bigint, precision = 6): string {
    let whole = value / decimal;

    let frac = value % decimal;
    const precisionDecimal = pow10(decimalCount - precision);
    if (frac % precisionDecimal > 0n) {
        // round up
        frac += precisionDecimal;
        if (frac >= decimal) {
            frac -= decimal;
            whole += 1n;
        }
    }
    frac /= precisionDecimal;

    return `${whole.toString()}${frac !== 0n ? '.' + frac.toString().padStart(precision, '0').replace(/0+$/, '') : ''}`;
}

function formatCoins(value: bigint | undefined, precision = 6): string {
    if (value === undefined) return 'N/A';

    return formatCoinsPure(value, precision) + ' TON';
}

export async function printSpamChain(transactions: Transaction[], masterCounter?: Address) {
    console.table(
        transactions
            .map((tx) => {
                if (tx.description.type !== 'generic') return undefined;

                const inBody = ['internal', 'external-in'].includes(tx.inMessage?.info.type || '')
                    ? tx.inMessage?.body.beginParse()
                    : undefined;
                let fromId =
                    inBody === undefined ? 'N/A' : inBody.remainingBits >= 16 ? inBody.preloadUint(16) : 'no id';

                let inTxType = 'hop';
                if (inBody?.remainingBits == 16) {
                    // only 16 bits in report msg
                    inTxType = 'report';
                }
                const dest = tx.inMessage?.info.dest;
                if (dest && Address.isAddress(dest) && masterCounter?.equals(dest)) {
                    inTxType = 'master';
                }

                if (tx.inMessage?.info.type == 'external-in') fromId = '-';

                let toId: string | number = 'no out';
                let outTxType = 'no out';

                if (tx.outMessages.size >= 1) {
                    const outMsg = tx.outMessages.get(0);
                    toId = outMsg?.body.beginParse().preloadUint(16) || 'no id';
                    const dest = outMsg?.info.dest;
                    if (dest && Address.isAddress(dest) && masterCounter?.equals(dest)) {
                        toId = outTxType = 'master';
                    }
                }

                if (toId == 0xffff) toId = 'bounce';
                if (fromId == 0xffff) {
                    fromId = 'bounced';
                    inTxType = 'bounce';
                }

                const valueIn = formatCoins(
                    tx.inMessage?.info.type === 'internal' ? tx.inMessage.info.value.coins : undefined
                );

                const valueOut = formatCoins(
                    tx.outMessages
                        .values()
                        .reduce(
                            (total, message) =>
                                total + (message.info.type === 'internal' ? message.info.value.coins : 0n),
                            0n
                        )
                );

                const computeFees = formatCoins(
                    tx.description.computePhase.type === 'vm' ? tx.description.computePhase.gasFees : undefined
                );

                const exitCode =
                    tx.description.computePhase.type === 'vm' ? tx.description.computePhase.exitCode : 'N/A';

                let status = 'ok';
                if (exitCode !== 0) status = 'failed ' + exitCode.toString();

                return {
                    onContract: inTxType,
                    status,
                    fromId,
                    toId,
                    outTxType,
                    valueIn,
                    valueOut,
                    outActions: tx.description.actionPhase?.totalActions ?? 'N/A',
                    computeFees,
                    exitCode,
                    actionCode: tx.description.actionPhase?.resultCode ?? 'N/A',
                };
            })
            .filter((v) => v !== undefined)
    );
}

export function printTPSHistory(history: Dictionary<number, bigint>) {
    let secTxs: bigint[] = [];
    console.table(
        history
            .keys()
            .sort()
            .map((time: number) => {
                const txs = history.get(time);
                if (!txs) return undefined;
                secTxs.push(txs);
                return {
                    time,
                    txs,
                };
            })
    );
    return secTxs;
}

export async function readCreateKeyPair(filename = 'wallet-retranslator.pk') {
    try {
        const secretKey = await readFile(filename);
        return keyPairFromSecretKey(secretKey);
    } catch {
        const keypair = keyPairFromSeed(await getSecureRandomBytes(32));
        await writeFile(filename, keypair.secretKey);
        return keypair;
    }
}

export const now = (): number => Math.floor(Date.now() / 1000);

function tpsForLastNSeconds(history: Dictionary<number, bigint>, endTime: number, n = 100) {
    let sum = 0n;
    for (let i = 0; i < n; i++) {
        // going from old to new (doesn't matter really)
        let txs = history.get(endTime - i);
        if (!txs) txs = 0n;
        sum += txs;
    }
    return Number(sum) / n;
}

export async function monitorTPSfromMaster(masterCounter: OpenedContract<MasterCounter>, ui: UIProvider) {
    let zeroQueue = 0; // if 20 avgs in order are zeroes - stop monitoring
    while (zeroQueue < 20) {
        const time = now();
        try {
            const history = await masterCounter.getHistory();
            const avg = tpsForLastNSeconds(history, time - HISTORY_GAP); // last second are not avaiable(
            if (avg == 0) zeroQueue++;
            else zeroQueue = 0;
            ui.setActionPrompt('Running: ' + avg + ' TPS');
        } catch {
            zeroQueue++;
            ui.setActionPrompt('Running: N/A TPS');
        }
        await sleep(2000);
    }
    ui.clearActionPrompt();
}

export async function parseIDFromData(provider: NetworkProvider, address: Address) {
    const api = provider.api();
    if (api instanceof TonClient4) {
        const { last } = await api.getLastBlock();
        const { account } = await api.getAccount(last.seqno, address);
        if (account.state.type !== 'active') throw new Error("Given account isn't active.");
        const id = Cell.fromBase64(account.state.data || '')
            .beginParse()
            .loadUint(16);
        return id;
    } else {
        const account = await api.getContractState(address);
        if (account.state !== 'active' || !!!account.data) throw new Error("Given account isn't active.");
        const id = Cell.fromBoc(account.data)[0].beginParse().loadUint(16);
        return id;
    }
}
