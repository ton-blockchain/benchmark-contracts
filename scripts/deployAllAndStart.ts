import { Address, Cell, fromNano, toNano } from 'ton-core';
import { MasterCounter } from '../wrappers/MasterCounter';
import { compile, NetworkProvider, sleep } from '@ton-community/blueprint';
import { monitorTPSfromMaster, now, readCreateKeyPair, setMasterCounter } from '../wrappers/utils';
import { Retranslator, RetranslatorOptions } from '../wrappers/Retranslator';

const spamConfig: RetranslatorOptions = {
    amount: toNano(150),
    hops: 10000,
    threads: 1,
    splitHops: 8,
    sameShardProbability: 0,
};

const masterCounterBalance = toNano('100');

function repackAddress(addr: any): Address {
    return Address.parse(addr.toString());
}

function repackCell(cell: any): Cell {
    return Cell.fromBoc(cell.toBoc())[0];
}

export async function run(provider: NetworkProvider) {
    const sender = provider.sender();
    const ui = provider.ui();
    const deployerAddr = repackAddress(sender.address);

    await ui.input(
        "You'll need about " +
            fromNano((spamConfig.amount || toNano(20000)) + masterCounterBalance + toNano(1)) +
            ' TON for this action. Press Enter to continue...'
    );

    const keypair = await readCreateKeyPair();

    const masterCounterCode = repackCell(await compile('MasterCounter'));
    // const masterCounterCode = await compile('MasterCounter');

    const _masterCounter = 
        MasterCounter.createFromConfig(
            { initializer: deployerAddr, publicKey: keypair.publicKey },
            masterCounterCode,
            -1 // workchain = masterchain
        )
    _masterCounter.address = repackAddress(_masterCounter.address);
    const masterCounter = provider.open(_masterCounter);

    setMasterCounter(masterCounter.address);

    const retranslatorCode = repackCell(await compile('Retranslator'));
    const counterCode = repackCell(await compile('Counter'));
    // const retranslatorCode = await compile('Retranslator');
    // const counterCode = await compile('Counter');

    const retranslator0 = provider.open(
        Retranslator.createFromConfig({ id: 0, keypair, counterCode }, retranslatorCode)
    );

    ui.write('Deploying master counter contract to the masterchain, addr: ' + masterCounter.address.toString() + '\n');
    await masterCounter.sendDeploy(sender, counterCode, masterCounterBalance);
    await provider.waitForDeploy(masterCounter.address, 10);
    ui.write('Deployed master counter: ' + masterCounter.address.toString() + '\n');

    const deployAmount = (spamConfig.amount || toNano(20000)) + toNano('1');
    ui.write(
        'Please, topup the first retranslator with ' +
            fromNano(deployAmount) +
            ' TON: ' +
            retranslator0.address.toString({ bounceable: false })
    );
    await ui.input("Press Enter when you're ready...");

    ui.write("We'll hope retranslator now have coins...\n");

    await ui.input('Press Enter to start the spam...');

    await retranslator0.sendStart(spamConfig);
    const startTime = now();

    sleep(3000);

    ui.write('Started spam. Here is the TPS monitor:\n');
    await monitorTPSfromMaster(masterCounter, ui);
    const endTime = now() - 120; // 2 mins for monitor to stop
    const totalTPS = await masterCounter.getTpsOnPeriod(startTime, endTime);
    ui.write('Total average TPS: ' + totalTPS.toString());
}
