import { Address } from '@ton/core';
import { MasterCounter } from '../wrappers/MasterCounter';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    ui.write("");
    const deployerAddr = Address.parse(args.length > 0 ? args[0] : await ui.input('Deployer address:'));

    const publicKeyStr = args.length > 1 ? args[1] : await ui.input('Public key hex:');

    if (publicKeyStr.length !== 64) {
        throw new Error('Invalid public key length');
    }
    const publicKey = Buffer.from(publicKeyStr, 'hex');

    const masterCounterCode = await compile('MasterCounter');

    const masterCounter = MasterCounter.createFromConfig(
        { owner: deployerAddr, publicKey },
        masterCounterCode,
        -1 // workchain = masterchain
    );

    ui.write('Calculated Master Counter address: ' + masterCounter.address.toString());
}
