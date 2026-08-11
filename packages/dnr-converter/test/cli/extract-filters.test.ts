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
import { Extractor } from '../../cli/extract-filters';

describe('Extractor', () => {
    let tmpDir: string;
    let filtersDir: string;
    let resourcesDir: string;
    let rulesetsDir: string;
    let extractDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnr-cli-extract-'));
        filtersDir = path.join(tmpDir, 'filters');
        resourcesDir = path.join(tmpDir, 'resources');
        rulesetsDir = path.join(tmpDir, 'rulesets');
        extractDir = path.join(tmpDir, 'extracted');
        fs.mkdirSync(filtersDir, { recursive: true });
        fs.mkdirSync(resourcesDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('extracts filters from rulesets produced by convertFilters', async () => {
        const filterContent = '||example.com^\n||example.org^\n';

        fs.writeFileSync(path.join(filtersDir, 'filter_1.txt'), filterContent);
        fs.writeFileSync(
            path.join(filtersDir, 'filters.json'),
            JSON.stringify([{ filterId: 1, name: 'Test Filter' }]),
        );

        // First convert
        await convertFilters(filtersDir, resourcesDir, rulesetsDir);

        // Then extract
        await Extractor.extract(rulesetsDir, extractDir);

        // Verify extracted filter exists
        const extractedPath = path.join(extractDir, 'filter_1.txt');
        expect(fs.existsSync(extractedPath)).toBe(true);

        // Verify content matches original
        const extracted = fs.readFileSync(extractedPath, 'utf-8');
        expect(extracted).toBe(filterContent);
    });

    it('extracts metadata from rulesets', async () => {
        const metadata = [{ filterId: 1, name: 'Test Filter' }];

        fs.writeFileSync(path.join(filtersDir, 'filter_1.txt'), '||example.com^\n');
        fs.writeFileSync(
            path.join(filtersDir, 'filters.json'),
            JSON.stringify(metadata),
        );

        await convertFilters(filtersDir, resourcesDir, rulesetsDir);
        await Extractor.extract(rulesetsDir, extractDir);

        const metadataPath = path.join(extractDir, 'filters.json');
        expect(fs.existsSync(metadataPath)).toBe(true);

        const extractedMetadata = JSON.parse(
            fs.readFileSync(metadataPath, 'utf-8'),
        );
        expect(extractedMetadata).toEqual(metadata);
    });
});
