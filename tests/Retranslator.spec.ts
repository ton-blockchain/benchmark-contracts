import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { Retranslator } from '../wrappers/Retranslator';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('Retranslator', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Retranslator');
    });

    let blockchain: Blockchain;
    let retranslator: SandboxContract<Retranslator>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        retranslator = blockchain.openContract(Retranslator.createFromConfig({}, code));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await retranslator.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: retranslator.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and retranslator are ready to use
    });
});
