import fs from 'fs';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { BrowserFilters } from '../../common/constants';
import { VALIDATOR_DATA_FILE_NAME } from '../../tasks/constants';

// We need to mock fs.readFileSync and the __dirname resolution before importing.
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        default: {
            ...actual,
            readFileSync: vi.fn(actual.readFileSync),
        },
        readFileSync: vi.fn(actual.readFileSync),
    };
});

describe('loadAllowedFilterIds', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * Helper to dynamically import the module fresh each time.
     *
     * @returns The `loadAllowedFilterIds` function.
     */
    const importFresh = async () => {
        const mod = await import('../../tasks/helpers');
        return mod.loadAllowedFilterIds;
    };

    it('returns undefined and warns when the data file is missing', async () => {
        vi.mocked(fs.readFileSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const loadAllowedFilterIds = await importFresh();
        const result = loadAllowedFilterIds(BrowserFilters.ChromiumMv3);

        expect(result).toBeUndefined();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(VALIDATOR_DATA_FILE_NAME),
        );
    });

    it('throws when browser entry is missing from data', async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
            // No entry for ChromiumMv3.
        }));

        const loadAllowedFilterIds = await importFresh();
        expect(() => loadAllowedFilterIds(BrowserFilters.ChromiumMv3)).toThrow(
            /missing entry for/,
        );
    });

    it('throws when rulesetIds is not an array', async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
            [BrowserFilters.ChromiumMv3]: { rulesetIds: 'not-an-array' },
        }));

        const loadAllowedFilterIds = await importFresh();
        expect(() => loadAllowedFilterIds(BrowserFilters.ChromiumMv3)).toThrow(
            /Invalid.*validator-data/,
        );
    });

    it('throws when rulesetIds contains string values instead of numbers', async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
            [BrowserFilters.ChromiumMv3]: { rulesetIds: ['1', '2', '3'] },
        }));

        const loadAllowedFilterIds = await importFresh();
        expect(() => loadAllowedFilterIds(BrowserFilters.ChromiumMv3)).toThrow(
            /Invalid.*validator-data/,
        );
    });

    it('throws when rulesetIds contains NaN', async () => {
        // JSON.parse of NaN isn't possible directly, but null is not a number.
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
            [BrowserFilters.ChromiumMv3]: { rulesetIds: [1, null, 3] },
        }));

        const loadAllowedFilterIds = await importFresh();
        expect(() => loadAllowedFilterIds(BrowserFilters.ChromiumMv3)).toThrow(
            /Invalid.*validator-data/,
        );
    });

    it('returns a Set of allowed filter IDs for valid data', async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
            [BrowserFilters.ChromiumMv3]: { rulesetIds: [1, 2, 3, 10, 20] },
        }));

        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        const loadAllowedFilterIds = await importFresh();
        const result = loadAllowedFilterIds(BrowserFilters.ChromiumMv3);

        expect(result).toEqual(new Set([1, 2, 3, 10, 20]));
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining('5 filters allowed'),
        );
    });

    it('handles empty rulesetIds array', async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
            [BrowserFilters.ChromiumMv3]: { rulesetIds: [] },
        }));

        vi.spyOn(console, 'info').mockImplementation(() => {});

        const loadAllowedFilterIds = await importFresh();
        const result = loadAllowedFilterIds(BrowserFilters.ChromiumMv3);

        expect(result).toEqual(new Set());
    });
});
