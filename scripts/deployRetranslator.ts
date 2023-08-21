import { toNano } from 'ton-core';
import { Retranslator } from '../wrappers/Retranslator';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const retranslator = provider.open(Retranslator.createFromConfig({}, await compile('Retranslator')));

    await retranslator.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(retranslator.address);

    // run methods on `retranslator`
}
