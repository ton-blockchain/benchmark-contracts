import { Address, Cell, fromNano, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { parseIDFromData, readCreateKeyPair } from '../wrappers/utils';
import { Retranslator, RetranslatorOptions } from '../wrappers/Retranslator';

const spamConfig: RetranslatorOptions = {
    amount: toNano(1000),
    hops: 40000,
    threads: 1,
    splitHops: 1,
    sameShardProbability: 1,
};

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

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

    ui.write(
        'Topup it ' +
            retranslator.address.toString({ bounceable: false }) +
            ' with ' +
            fromNano((spamConfig.amount || toNano(20000)) + toNano(1)) +
            ' TON'
    );
    await ui.input('Press Enter to start the spam...');

    await retranslator.sendStart(spamConfig);
    ui.write('Started spam.\n');
}
