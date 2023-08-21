import { compile as compileFunc } from '@ton-community/blueprint';
import { CompilerConfig } from '@ton-community/blueprint';
import { auto } from './utils';
import path from 'path';
import fs from 'fs';

export const compile: CompilerConfig = {
    lang: 'func',
    preCompileHook: async () => {
        const retranslatorCodePath = path.join(auto, `retranslator-code.fc`);
        if (!fs.existsSync(retranslatorCodePath)) {
            // also this will check for master-counter-address.func
            await compileFunc('Retranslator');
        }
    },
    targets: [
        `contracts/auto/master-counter-address.fc`,
        `contracts/auto/retranslator-code.fc`,
        'contracts/counter.fc',
    ],
};
