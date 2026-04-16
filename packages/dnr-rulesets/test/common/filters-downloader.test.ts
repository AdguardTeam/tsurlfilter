import fs from 'node:fs';
import path from 'node:path';

import axios from 'axios';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { BrowserFilters } from '../../common/constants';
import { startDownload } from '../../common/filters-downloader';
import type { Metadata } from '../../common/metadata';
import { downloadI18nMetadata, downloadMetadata } from '../../common/metadata';

// Mock metadata downloads — return test data without HTTP calls.
vi.mock('../../common/metadata', () => ({
    downloadMetadata: vi.fn(),
    downloadI18nMetadata: vi.fn(),
}));

// Mock axios to prevent any real HTTP requests.
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
    },
}));

// Mock fs-extra's ensureDir.
vi.mock('fs-extra', () => ({
    ensureDir: vi.fn(),
}));

describe('startDownload', () => {
    let tmpDir: string;

    /**
     * Creates a minimal {@link Metadata} object with the given filter IDs.
     *
     * @param filterIds Array of filter IDs to include.
     *
     * @returns Metadata object.
     */
    const createMetadata = (filterIds: number[]): Metadata => ({
        filters: filterIds.map((filterId) => ({
            description: `Filter ${filterId}`,
            displayNumber: filterId,
            expires: 86400,
            filterId,
            groupId: 1,
            homepage: '',
            name: `Filter ${filterId}`,
            tags: [],
            version: '1.0.0',
            languages: [],
            timeAdded: '',
            timeUpdated: '',
            subscriptionUrl: '',
        })),
        groups: [],
    });

    beforeEach(async () => {
        vi.clearAllMocks();

        tmpDir = await fs.promises.mkdtemp(path.join(
            await fs.promises.realpath(import.meta.dirname ?? '.'),
            'test-filters-',
        ));

        // Default: metadata returns 5 filters.
        vi.mocked(downloadMetadata).mockResolvedValue(createMetadata([1, 2, 3, 4, 5]));
        vi.mocked(downloadI18nMetadata).mockResolvedValue(undefined);

        // axios.get returns empty filter content for any URL.
        vi.mocked(axios.get).mockResolvedValue({ data: '' });
    });

    afterEach(async () => {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    });

    it('downloads all filters when allowedFilterIds is not provided', async () => {
        await startDownload(tmpDir, BrowserFilters.ChromiumMv3);

        // All 5 filters should be downloaded.
        expect(axios.get).toHaveBeenCalledTimes(5);
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/1.txt'),
            expect.anything(),
        );
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/5.txt'),
            expect.anything(),
        );
    });

    it('downloads only allowed filters when allowedFilterIds is provided', async () => {
        const allowed = new Set([1, 2, 3]);

        await startDownload(tmpDir, BrowserFilters.ChromiumMv3, allowed);

        // Only 3 filters should be downloaded, not 5.
        expect(axios.get).toHaveBeenCalledTimes(3);
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/1.txt'),
            expect.anything(),
        );
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/3.txt'),
            expect.anything(),
        );
        // Filters 4 and 5 should NOT be downloaded.
        expect(axios.get).not.toHaveBeenCalledWith(
            expect.stringContaining('/4.txt'),
            expect.anything(),
        );
        expect(axios.get).not.toHaveBeenCalledWith(
            expect.stringContaining('/5.txt'),
            expect.anything(),
        );
    });

    it('handles allowedFilterIds with IDs not present in metadata gracefully', async () => {
        // Allowlist includes ID 99 which is not in metadata (1-5).
        // Should download intersection: only 1, 2.
        const allowed = new Set([1, 2, 99]);

        await startDownload(tmpDir, BrowserFilters.ChromiumMv3, allowed);

        expect(axios.get).toHaveBeenCalledTimes(2);
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/1.txt'),
            expect.anything(),
        );
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/2.txt'),
            expect.anything(),
        );
    });

    it('downloads nothing when allowedFilterIds is empty', async () => {
        const allowed = new Set<number>();

        await startDownload(tmpDir, BrowserFilters.ChromiumMv3, allowed);

        // No filter downloads should occur.
        expect(axios.get).not.toHaveBeenCalled();
    });

    it('saves filtered metadata to disk when allowedFilterIds is provided', async () => {
        const allowed = new Set([1, 3]);

        await startDownload(tmpDir, BrowserFilters.ChromiumMv3, allowed);

        // The metadata file should have been re-saved with only allowed filters.
        const savedMetadataPath = path.join(tmpDir, 'filters.json');
        const savedContent = await fs.promises.readFile(savedMetadataPath, 'utf-8');
        const savedMetadata = JSON.parse(savedContent) as Metadata;

        expect(savedMetadata.filters).toHaveLength(2);
        expect(savedMetadata.filters.map((f) => f.filterId)).toEqual([1, 3]);
    });
});
