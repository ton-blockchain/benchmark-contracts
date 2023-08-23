import { Blockchain, SandboxContract, TreasuryContract, internal, printTransactionFees } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { MasterCounter } from '../wrappers/MasterCounter';
import { Retranslator, RetranslatorOptions } from '../wrappers/Retranslator';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { Counter } from '../wrappers/Counter';
import { KeyPair, getSecureRandomBytes, keyPairFromSeed } from '@ton/crypto';
import { setMasterCounter, printSpamChain, printTPSHistory, now } from '../wrappers/utils';

describe('MasterCounter', () => {
    let blockchain: Blockchain;
    let keypair: KeyPair;
    let masterCounter: SandboxContract<MasterCounter>;
    let retranslator0: SandboxContract<Retranslator>;
    let counter0: SandboxContract<Counter>;
    let deployer: SandboxContract<TreasuryContract>;
    let spamConfig: RetranslatorOptions = {
        amount: toNano(1300),
        hops: 2000,
        threads: 1,
        splitHops: 0,
        sameShardProbability: 1,
    };
    let counterCode: Cell;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        keypair = keyPairFromSeed(await getSecureRandomBytes(32));

        let masterCounterCode = await compile('MasterCounter');
        masterCounter = blockchain.openContract(
            MasterCounter.createFromConfig(
                { initializer: deployer.address, publicKey: keypair.publicKey },
                masterCounterCode,
                -1 // workchain = masterchain
            )
        );
        setMasterCounter(masterCounter.address);

        let retranslatorCode = await compile('Retranslator');
        counterCode = await compile('Counter');

        retranslator0 = blockchain.openContract(
            Retranslator.createFromConfig({ id: 0, keypair, counterCode }, retranslatorCode)
        );

        counter0 = blockchain.openContract(
            Counter.createFromConfig({ id: 0, publicKey: keypair.publicKey }, counterCode)
        );

        const deployMasterResult = await masterCounter.sendDeploy(deployer.getSender(), counterCode, toNano('1000'));

        expect(deployMasterResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterCounter.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy master counter', async () => {
        // checks the success of beforeAll
    });

    it('should deploy first retranslator and start flooding', async () => {
        await blockchain.setVerbosityForAddress(masterCounter.address, { vmLogs: 'vm_logs' });
        await deployer.send({
            to: retranslator0.address, // topup
            value: toNano('100000'),
            bounce: false,
        });
        const startResult = await retranslator0.sendStart(spamConfig);
        expect(startResult.transactions).toHaveTransaction({
            from: undefined, // external
            on: retranslator0.address,
            deploy: true,
            success: true,
        });

        printSpamChain(startResult.transactions, masterCounter.address);
        // printTransactionFees(startResult.transactions)
    });
    const t = now();
    it('should report to master from 0th', async () => {
        const counterAmountB = await masterCounter.getCounter();
        console.log("counter before 0th's 10:", counterAmountB);
        const masterContract = await blockchain.getContract(masterCounter.address);
        masterContract.receiveMessage(
            internal({
                from: counter0.address,
                to: masterCounter.address,
                value: toNano('0.4'),
                body: MasterCounter.addMessageBody(0, 10, t, t + 10),
            })
        );
        const counterAmountA = await masterCounter.getCounter();
        console.log("counter after 0th's 10:", counterAmountA);
    });
    it('should report to master from 100th counter', async () => {
        const counterAmountB = await masterCounter.getCounter();
        console.log("counter before 100th's 20:", counterAmountB);
        // await blockchain.setVerbosityForAddress(masterCounter.address, { vmLogs: 'vm_logs' });
        const masterContract = await blockchain.getContract(masterCounter.address);
        const counter100 = blockchain.openContract(
            Counter.createFromConfig({ id: 100, publicKey: keypair.publicKey }, counterCode)
        );
        masterContract.receiveMessage(
            internal({
                from: counter100.address,
                to: masterCounter.address,
                value: toNano('2'),
                body: MasterCounter.addMessageBody(100, 20, t, t + 20),
            })
        );
        const counterAmountA = await masterCounter.getCounter();
        console.log("counter after 100th's 20:", counterAmountA);
    });
    it('should show counter', async () => {
        const counterAmount = await masterCounter.getCounter();
        console.log('Total counter:', counterAmount);
    });
    it('should show the result', async () => {
        const history = await masterCounter.getHistory();
        const secTxs = printTPSHistory(history);
        const counterAmount = await masterCounter.getCounter();
        console.log('Total counter:', counterAmount);
        console.log('Avg TPS:', counterAmount / BigInt(secTxs.length));
    });
});
