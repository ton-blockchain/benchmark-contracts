import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { Retranslator } from '../wrappers/Retranslator';
import { Counter } from '../wrappers/Counter';
import { MasterCounter } from '../wrappers/MasterCounter';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('Counter', () => {
    let retranslatorCode: Cell;
    let counterCode: Cell;
    let masterCounterCode: Cell;

    let blockchain: Blockchain;
    let counter: SandboxContract<Counter>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        retranslatorCode = await compile('Retranslator');
        counterCode = await compile('Counter');
        masterCounterCode = await compile('MasterCounter');

        counter = blockchain.openContract(Counter.createFromConfig({}, code));
        const deployer = await blockchain.treasury('deployer');
        const deployResult = await counter.sendDeploy(deployer.getSender(), toNano('0.05'));
    });

    beforeEach(async () => {

        counter = blockchain.openContract(Counter.createFromConfig({}, code));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await counter.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: counter.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and counter are ready to use
    });
});
