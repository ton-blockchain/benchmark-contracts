import { CompilerConfig } from '@ton-community/blueprint';
import { writeFile, mkdir } from 'fs/promises';
import { auto } from './utils';
import path from 'path';
import fs from 'fs';

export const compile: CompilerConfig = {
    lang: 'func',
    preCompileHook: async () => {
        const addrPath = path.join(auto, 'master-counter-address.fc');
        if (!fs.existsSync(addrPath)) {
            throw new Error(
                'Master counter address not defined in contracts/auto/master-counter-address.fc, use setMasterCounter'
            );
        }
    },
    targets: ['contracts/retranslator.fc'],
    postCompileHook: async (code) => {
        await mkdir(auto, { recursive: true });
        await writeFile(
            path.join(auto, 'retranslator-code.fc'),
            `cell retranslator_code() asm "B{${code.toBoc().toString('hex')}} B>boc PUSHREF";`
        );
    },
};
