import { toNano } from 'ton-core';
import { MasterCounter } from '../wrappers/MasterCounter';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const masterCounter = provider.open(
        MasterCounter.createFromConfig(
            {
                id: Math.floor(Math.random() * 10000),
                counter: 0,
            },
            await compile('MasterCounter')
        )
    );

    await masterCounter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(masterCounter.address);

    console.log('ID', await masterCounter.getID());
}
