import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode,
    toNano,
    TupleBuilder,
} from 'ton-core';

export type MasterCounterConfig = {
    initializer: Address;
    publicKey: Buffer;
};

export function masterCounterConfigToCell(config: MasterCounterConfig): Cell {
    /*
    _$0 initializer:MsgAddress counter:uint256 history:(HashmapE 48 uint64) public_key:uint256 = Storage;
    _$1 counter:uint256 history:(HashmapE 48 uint64) public_key:uint256 counter_code:^Cell = Storage;
    */
    return beginCell()
        .storeBit(0) // uninit
        .storeAddress(config.initializer)
        .storeUint(0, 256) // counter
        .storeDict(Dictionary.empty()) // history
        .storeBuffer(config.publicKey, 32)
        .endCell(); // to be filled on init
}

export class MasterCounter implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new MasterCounter(address);
    }

    static createFromConfig(config: MasterCounterConfig, code: Cell, workchain = 0) {
        const data = masterCounterConfigToCell(config);
        const init = { code, data };
        return new MasterCounter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, counterCode: Cell, value: bigint = toNano('1')) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeRef(counterCode).endCell(),
        });
    }

    static addMessageBody(senderId: number, toAdd: number, fromTime: number, toTime: number) {
        return beginCell()
            .storeUint(senderId, 16)
            .storeUint(toAdd, 32)
            .storeUint(fromTime, 48)
            .storeUint(toTime, 48)
            .endCell();
    }

    async getCounter(provider: ContractProvider) {
        const result = await provider.get('get_counter', []);
        return result.stack.readBigNumber();
    }

    async getHistory(provider: ContractProvider) {
        const result = await provider.get('get_history', []);
        return Dictionary.loadDirect(
            Dictionary.Keys.Uint(48), // key : uint48 - timestamp
            Dictionary.Values.BigUint(64), // value : uint64 - counter
            result.stack.readCellOpt()
        );
    }

    async getTxsOnSecond(provider: ContractProvider, second: number) {
        let args = new TupleBuilder();
        args.writeNumber(second);
        const result = await provider.get('get_txs_on_second', args.build());
        return result.stack.readBigNumber();
    }

    async getTxsOnPeriod(provider: ContractProvider, from: number, to: number) {
        let args = new TupleBuilder();
        args.writeNumber(from);
        args.writeNumber(to);
        const result = await provider.get('get_txs_on_period', args.build());
        return result.stack.readBigNumber();
    }

    async getTpsOnPeriod(provider: ContractProvider, from: number, to: number) {
        let args = new TupleBuilder();
        args.writeNumber(from);
        args.writeNumber(to);
        const result = await provider.get('get_tps_on_period', args.build());
        return result.stack.readNumber();
    }
}
