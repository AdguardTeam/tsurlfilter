import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_DIR = path.resolve(__dirname, '../../../../src/lib/common/canvas-protection');

/**
 * Modules bundled into the page engine. Background modules such as the policy compiler,
 * the logger or `@adguard/tsurlfilter` must never be reached from the entry.
 */
const ENGINE_MODULES = [
    'bootstrap',
    'constants',
    'contracts',
    'engine-entry',
    'intrinsics',
    'masking',
    'noise',
    'policy',
    'readout',
    'realm',
    'taint',
];

/**
 * Collects the modules reachable from a module by static imports and re-exports.
 *
 * @param name Module name in the canvas protection directory.
 * @param reached Modules collected so far.
 *
 * @returns The collected modules.
 */
const collect = (name: string, reached = new Set<string>()): Set<string> => {
    reached.add(name);
    const source = readFileSync(path.join(SOURCE_DIR, `${name}.ts`), 'utf8');
    for (const [, specifier] of source.matchAll(/\bfrom '([^']+)'/g)) {
        expect(specifier, `${name}.ts imports ${specifier}`).toMatch(/^\.\/[\w-]+$/);
        const imported = specifier.slice(2);
        if (!reached.has(imported)) {
            collect(imported, reached);
        }
    }
    return reached;
};

describe('Canvas protection engine entry', () => {
    it('imports only engine modules', () => {
        expect([...collect('engine-entry')].sort()).toEqual(ENGINE_MODULES);
    });
});
