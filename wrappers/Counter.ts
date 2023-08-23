import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type CounterConfig = {
    id: number;
    publicKey: Buffer;
};

export function counterConfigToCell(config: CounterConfig, code: Cell): Cell {
    return beginCell()
        .storeUint(config.id, 16)
        .storeBuffer(config.publicKey, 32)
        .storeUint(0, 32)
        .storeUint(0, 48)
        .storeRef(code)
        .endCell();
}

export class Counter implements Contract {
    constructor(readonly address: Address, readonly id: number, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Counter(address, 0);
    }

    static createFromConfig(config: CounterConfig, code: Cell, workchain = 0) {
        const data = counterConfigToCell(config, code);
        const init = { code, data };
        return new Counter(contractAddress(workchain, init), config.id, init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
