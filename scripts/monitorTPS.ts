import { Address } from 'ton-core';
import { MasterCounter } from '../wrappers/MasterCounter';
import { NetworkProvider } from '@ton-community/blueprint';
import { monitorTPSfromMaster } from '../wrappers/utils';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('MasterCounter address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }
    const masterCounter = provider.open(MasterCounter.createFromAddress(address));

    await monitorTPSfromMaster(masterCounter, ui);
}
