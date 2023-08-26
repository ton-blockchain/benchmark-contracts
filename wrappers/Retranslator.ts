import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, SendMode, toNano } from '@ton/core';
import { KeyPair, sign } from '@ton/crypto';

const CHANCE_BASE = 65535;
const fl = Math.floor;

export type RetranslatorConfig = {
    id: number;
    keypair: KeyPair;
    counterCode: Cell;
};

export type RetranslatorOptions = {
    threads?: number; // 1
    hops?: number; // 20000
    splitHops?: number; // 8
    amount?: bigint; // 99 nTON
    txsPerReport?: number; // 8
    sameShardProbability?: number; // 0.5
    extraDataSizeBytesOrRef?: number | Cell; // none
};

export function retranslatorConfigToCell(config: RetranslatorConfig, code: Cell): Cell {
    return beginCell()
        .storeUint(config.id, 16)
        .storeUint(0, 32) // seqno
        .storeBuffer(config.keypair.publicKey, 32)
        .storeRef(code)
        .storeRef(config.counterCode)
        .endCell();
}

export class Retranslator implements Contract {
    constructor(
        readonly address: Address,
        readonly config: RetranslatorConfig,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address, config: RetranslatorConfig) {
        return new Retranslator(address, config);
    }

    static createFromConfig(config: RetranslatorConfig, code: Cell, workchain = 0) {
        const data = retranslatorConfigToCell(config, code);
        const init = { code, data };
        return new Retranslator(contractAddress(workchain, init), config, init);
    }

    async signAndSendExternal(provider: ContractProvider, msg: Cell) {
        const hash = msg.hash();
        const signature = sign(hash, this.config.keypair.secretKey);
        const query = beginCell()
            .storeBuffer(signature, 64) // 512 bits signature
            .storeSlice(msg.asSlice()) // the rest - message
            .endCell();
        await provider.external(query);
    }

    async sendStart(provider: ContractProvider, opts: RetranslatorOptions = {}, now?: number) {
        let seqno = await this.getSeqno(provider);
        if (seqno == -1) seqno = 0;
        let msg = beginCell()
            .storeUint(this.config.id, 32)
            .storeUint(now || fl(Date.now() / 1000) + 40, 32) // valid_until
            .storeUint(seqno, 32)
            .storeUint(255, 8) // mode = retranslate
            .storeUint(opts.threads == undefined ? 1 : opts.threads, 8)
            .storeUint(opts.hops == undefined ? 20000 : opts.hops, 16)
            .storeUint(opts.splitHops == undefined ? 5 : opts.splitHops, 8)
            .storeUint(opts.txsPerReport == undefined ? 8 : opts.txsPerReport, 16)
            .storeUint(
                opts.sameShardProbability == undefined //
                    ? fl(0.5 * CHANCE_BASE) // 50% by default
                    : fl(opts.sameShardProbability * CHANCE_BASE),
                16
            )
            .storeCoins(opts.amount == undefined ? toNano('99') : opts.amount);
        if (opts.extraDataSizeBytesOrRef instanceof Cell) {
            msg = msg.storeRef(opts.extraDataSizeBytesOrRef);
        } else {
            const size = opts.extraDataSizeBytesOrRef;
            if (!!size) msg = msg.storeBuffer(Buffer.alloc(size), size);
        }
        await this.signAndSendExternal(provider, msg.endCell());
    }

    async sendMsgAsWallet(provider: ContractProvider, fullMsg: Cell, sendMode: SendMode, now?: number) {
        let seqno = await this.getSeqno(provider);
        if (seqno == -1) seqno = 0;
        const msg = beginCell()
            .storeUint(this.config.id, 32)
            .storeUint(now || fl(Date.now() / 1000) + 40, 32) // valid_until
            .storeUint(seqno, 32)
            .storeUint(sendMode, 8)
            .storeRef(fullMsg)
            .endCell();
        await this.signAndSendExternal(provider, msg);
    }

    async getSeqno(provider: ContractProvider) {
        try {
            const { stack } = await provider.get('seqno', []);
            return stack.readNumber();
        } catch (e) {
            return -1;
        }
    }
}
