import { Address, Cell, SendMode, beginCell } from 'ton-core';
import { NetworkProvider } from '@ton-community/blueprint';
import { parseIDFromData, readCreateKeyPair } from '../wrappers/utils';
import { Retranslator } from '../wrappers/Retranslator';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const keypair = await readCreateKeyPair();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Address to withdraw from'));
    const toAddress = Address.parse(args.length > 0 ? args[0] : await ui.input('Destination address'));

    const id = await parseIDFromData(provider, address);
    const contract = provider.open(
        Retranslator.createFromAddress(address, { keypair: keypair, id, counterCode: Cell.EMPTY }),
    );

    await contract.sendMsgAsWallet(
        beginCell()
            .storeUint(0x10, 6)
            .storeAddress(toAddress)
            .storeCoins(0)
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeUint(0xd53276db, 32) // excesses
            .storeUint(0, 64)
            .endCell(),
        SendMode.CARRY_ALL_REMAINING_BALANCE,
    );
}
