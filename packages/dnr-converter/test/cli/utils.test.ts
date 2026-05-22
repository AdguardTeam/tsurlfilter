import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';

import {
    ensureDir,
    findFiles,
    generateMD5Hash,
    getIdFromFilterName,
    getRuleSetPath,
} from '../../cli/utils';

describe('CLI utils', () => {
    describe('generateMD5Hash', () => {
        it('generates correct MD5 hash', () => {
            const hash = generateMD5Hash('Hello, world!');
            expect(hash).toBe('6cd3556deb0da54bca060b4c39479839');
        });

        it('generates different hashes for different inputs', () => {
            const hash1 = generateMD5Hash('input1');
            const hash2 = generateMD5Hash('input2');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('getIdFromFilterName', () => {
        it('extracts filter id from valid filename', () => {
            expect(getIdFromFilterName('filter_1.txt')).toBe(1);
            expect(getIdFromFilterName('filter_123.txt')).toBe(123);
        });

        it('returns null for invalid filenames', () => {
            expect(getIdFromFilterName('filters.json')).toBeNull();
            expect(getIdFromFilterName('readme.md')).toBeNull();
            expect(getIdFromFilterName('filter_.txt')).toBeNull();
        });
    });

    describe('getRuleSetPath', () => {
        it('constructs correct path for a ruleset', () => {
            const result = getRuleSetPath('ruleset_1', '/output');
            expect(result).toBe(path.join('/output', 'ruleset_1', 'ruleset_1.json'));
        });
    });

    describe('ensureDir', () => {
        const tmpDir = path.join(os.tmpdir(), 'dnr-converter-test-ensure');

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('creates directory if it does not exist', async () => {
            const dir = path.join(tmpDir, 'subdir');
            await ensureDir(dir);
            expect(fs.existsSync(dir)).toBe(true);
        });

        it('does nothing if directory exists', async () => {
            fs.mkdirSync(tmpDir, { recursive: true });
            await expect(ensureDir(tmpDir)).resolves.toBeUndefined();
        });
    });

    describe('findFiles', () => {
        const tmpDir = path.join(os.tmpdir(), 'dnr-converter-test-find');

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('finds files matching filter', async () => {
            fs.mkdirSync(path.join(tmpDir, 'sub'), { recursive: true });
            fs.writeFileSync(path.join(tmpDir, 'a.json'), '{}');
            fs.writeFileSync(path.join(tmpDir, 'b.txt'), '');
            fs.writeFileSync(path.join(tmpDir, 'sub', 'c.json'), '{}');

            const results = await findFiles(tmpDir, (f) => f.endsWith('.json'));
            expect(results).toHaveLength(2);
            expect(results.every((f) => f.endsWith('.json'))).toBe(true);
        });
    });
});
