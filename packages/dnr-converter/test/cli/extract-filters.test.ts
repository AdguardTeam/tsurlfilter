import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { convertFilters } from '../../cli/convert-filters';
import { Extractor } from '../../cli/extract-filters';
import { createMetadataRuleMock } from '../mocks/metadata-rule';

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

    it('reports an unreadable ruleset file and keeps extracting the others', async () => {
        fs.writeFileSync(path.join(filtersDir, 'filter_1.txt'), '||example.com^\n');
        fs.writeFileSync(
            path.join(filtersDir, 'filters.json'),
            JSON.stringify([{ filterId: 1, name: 'Test Filter' }]),
        );
        await convertFilters(filtersDir, resourcesDir, rulesetsDir);

        // A metadata rule without a string chunk.
        const brokenDir = path.join(rulesetsDir, 'ruleset_5');
        fs.mkdirSync(brokenDir, { recursive: true });
        fs.writeFileSync(path.join(brokenDir, 'ruleset_5.json'), JSON.stringify([
            createMetadataRuleMock({ filterContent: '||broken.com^' }),
        ]));

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await Extractor.extract(rulesetsDir, extractDir);

            // Assert before `mockRestore()`, which also clears recorded calls.
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('ruleset_5.json'),
                expect.objectContaining({ message: expect.stringContaining('is not a string') }),
            );
        } finally {
            errorSpy.mockRestore();
        }

        expect(fs.existsSync(path.join(extractDir, 'filter_1.txt'))).toBe(true);
        expect(fs.existsSync(path.join(extractDir, 'filter_5.txt'))).toBe(false);
    });
});
