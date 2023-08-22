import { Dictionary, fromNano, toNano } from 'ton-core';
import { MasterCounter } from '../wrappers/MasterCounter';
import { compile, NetworkProvider, sleep } from '@ton-community/blueprint';
import { now, readCreateKeyPair, setMasterCounter } from '../wrappers/utils';
import { Retranslator, RetranslatorOptions } from '../wrappers/Retranslator';

const spamConfig: RetranslatorOptions = {
    amount: toNano(1300),
    hops: 2000,
    threads: 1,
    splitHops: 0,
    sameShardProbability: 0,
};

function tpsForLastNSeconds(history: Dictionary<number, bigint>, endTime: number, n = 10) {
    let sum = 0n;
    for (let i = 0; i < n; i++) {
        // going from old to new (doesn't matter really)
        const txs = history.get(endTime - i) || 0n;
        sum += txs;
    }
    return Number(sum) / n;
}

export async function run(provider: NetworkProvider) {
    const sender = provider.sender();
    const ui = provider.ui();
    if (!sender.address) throw new Error('Connect wallet');

    await ui.input(
        "You'll need about " +
            fromNano((spamConfig.amount || toNano(20000)) + toNano(1001)) +
            ' TON for this action. Press Enter to continue.'
    );

    const keypair = await readCreateKeyPair();
    const masterCounter = provider.open(
        MasterCounter.createFromConfig(
            { initializer: sender.address, publicKey: keypair.publicKey },
            await compile('MasterCounter'),
            -1 // workchain = masterchain
        )
    );

    setMasterCounter(masterCounter.address);

    const retranslatorCode = await compile('Retranslator');
    const counterCode = await compile('Counter');

    const retranslator0 = provider.open(
        Retranslator.createFromConfig({ id: 0, keypair, counterCode }, retranslatorCode)
    );

    ui.write('Deploying master counter contract to the masterchain, addr: ' + masterCounter.address.toString() + '\n');
    await masterCounter.sendDeploy(sender, counterCode, toNano(1000));
    await provider.waitForDeploy(masterCounter.address, 10);
    ui.write('Deployed master counter: ' + masterCounter.address.toString() + '\n');

    ui.write('Topuping first retranslator, addr: ' + retranslator0.address.toString() + '\n');
    const deployAmount = (spamConfig.amount || toNano(20000)) + toNano('1');
    await sender.send({
        to: retranslator0.address,
        value: deployAmount,
        bounce: false,
    });
    ui.write('Waiting 20s for tx\n');
    sleep(20000);

    const { account } = await provider.api().getAccount(0, retranslator0.address);
    if (account.balance.coins !== deployAmount.toString()) {
        throw new Error('Failed to topup retranslator');
    }
    ui.write('Retranslator now have coins, addr: ' + retranslator0.address.toString() + '\n');

    await ui.input(
        'Press Enter to spam with this configuration (can be changed in code)\n' + JSON.stringify(spamConfig) + '\n?'
    );

    await retranslator0.sendStart(spamConfig);
    const startTime = now();

    sleep(1000);

    ui.write('Started spam. Here is the TPS monitor:\n');

    let zeroQueue = 0; // if 10 avg in order are zeroes - stop monitoring
    while (zeroQueue < 10) {
        const time = now();
        const history = await masterCounter.getHistory();
        const avg = tpsForLastNSeconds(history, time);
        if (avg == 0) zeroQueue++;
        else zeroQueue = 0;
        ui.setActionPrompt('Running: ' + avg + ' Txs per second');
        sleep(2000);
    }
    ui.clearActionPrompt();

    const endTime = now();
    const totalTPS = await masterCounter.getTpsOnPeriod(startTime, endTime);
    ui.write('Total average TPS: ' + totalTPS.toString());
}
