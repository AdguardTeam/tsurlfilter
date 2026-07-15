import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { convertFilters } from '../../cli/convert-filters';

describe('convertFilters', () => {
    let tmpDir: string;
    let filtersDir: string;
    let resourcesDir: string;
    let outputDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnr-cli-convert-'));
        filtersDir = path.join(tmpDir, 'filters');
        resourcesDir = path.join(tmpDir, 'resources');
        outputDir = path.join(tmpDir, 'output');
        fs.mkdirSync(filtersDir, { recursive: true });
        fs.mkdirSync(resourcesDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('converts a simple filter to DNR ruleset', async () => {
        // Create a simple filter file
        fs.writeFileSync(
            path.join(filtersDir, 'filter_1.txt'),
            '||example.com^\n',
        );

        // Create filters.json metadata
        fs.writeFileSync(
            path.join(filtersDir, 'filters.json'),
            JSON.stringify([{ filterId: 1, name: 'Test Filter' }]),
        );

        await convertFilters(filtersDir, resourcesDir, outputDir);

        // Check that output directory was created
        expect(fs.existsSync(outputDir)).toBe(true);

        // Check that a ruleset file was produced
        const rulesetPath = path.join(outputDir, 'ruleset_1', 'ruleset_1.json');
        expect(fs.existsSync(rulesetPath)).toBe(true);

        // Verify it's valid JSON
        const content = fs.readFileSync(rulesetPath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
    });

    it('produces metadata ruleset', async () => {
        fs.writeFileSync(
            path.join(filtersDir, 'filter_1.txt'),
            '||example.com^\n',
        );
        fs.writeFileSync(
            path.join(filtersDir, 'filters.json'),
            JSON.stringify([{ filterId: 1, name: 'Test Filter' }]),
        );

        await convertFilters(filtersDir, resourcesDir, outputDir);

        // Metadata ruleset uses METADATA_RULESET_ID (which is 0)
        const metadataPath = path.join(outputDir, 'ruleset_0', 'ruleset_0.json');
        expect(fs.existsSync(metadataPath)).toBe(true);

        const content = fs.readFileSync(metadataPath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(Array.isArray(parsed)).toBe(true);
    });

    it('respects prettifyJson option', async () => {
        fs.writeFileSync(
            path.join(filtersDir, 'filter_1.txt'),
            '||example.com^\n',
        );
        fs.writeFileSync(
            path.join(filtersDir, 'filters.json'),
            JSON.stringify([{ filterId: 1, name: 'Test Filter' }]),
        );

        await convertFilters(filtersDir, resourcesDir, outputDir, {
            prettifyJson: false,
        });

        const rulesetPath = path.join(outputDir, 'ruleset_1', 'ruleset_1.json');
        const content = fs.readFileSync(rulesetPath, 'utf-8');
        // Minified JSON should not contain newlines within the array
        expect(content.startsWith('[')).toBe(true);
        // Verify it's a single line (no pretty formatting)
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        expect(lines.length).toBe(1);
    });
});
