import { Address, toNano } from 'ton-core';
import { MasterCounter } from '../wrappers/MasterCounter';
import { NetworkProvider, sleep } from '@ton-community/blueprint';
import { printTPSHistory } from '../wrappers/utils';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('MasterCounter address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }
    const masterCounter = provider.open(MasterCounter.createFromAddress(address));

    const history = await masterCounter.getHistory();
    const secTxs = printTPSHistory(history);
    const counterAmount = await masterCounter.getCounter();
    console.log('Total counter:', counterAmount);
    console.log('Avg TPS:', counterAmount / BigInt(secTxs.length));
}
