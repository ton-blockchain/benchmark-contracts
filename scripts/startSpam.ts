import { Address, Cell, SendMode, fromNano, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { parseIDFromData, readCreateKeyPair } from '../wrappers/utils';
import { Retranslator, RetranslatorOptions } from '../wrappers/Retranslator';

const spamConfig: RetranslatorOptions = {
    amount: toNano(4000000),
    hops: 999999999,
    threads: 20,
    splitHops: 9,
    sameShardProbability: 1.0,
};

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();
    const sender = provider.sender();

    const keypair = await readCreateKeyPair();

    const retranslatorAddress = Address.parse(args.length > 0 ? args[0] : await ui.input('Any retranslator address'));
    const retranslatorID = await parseIDFromData(provider, retranslatorAddress);

    const retranslator = provider.open(
        Retranslator.createFromAddress(retranslatorAddress, {
            keypair: keypair,
            id: retranslatorID,
            counterCode: Cell.EMPTY,
        })
    );

    const topupAmount = (spamConfig.amount || toNano(20000)) * BigInt(spamConfig.threads || 1) + toNano('1');
    try {
        ui.write("Trying to topup from connected wallet (won't work with mobile wallets)");
        await sender.send({
            to: retranslator.address,
            value: topupAmount,
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });
    } catch {
        ui.write(
            'Please, topup the retranslator with ' +
                fromNano(topupAmount) +
                ' TON: ' +
                retranslator.address.toString({ bounceable: false })
        );
        await ui.input("Press Enter when you're ready...");
    }
    await ui.input('Press Enter to start the spam...');

    await retranslator.sendStart(spamConfig);
    ui.write('Started spam.\n');
}
