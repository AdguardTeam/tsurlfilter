import fs from 'fs';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { VALIDATOR_DATA_FILE_NAME } from '../../tasks/constants';

// We need to mock fs.readFileSync before importing.
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
        const result = loadAllowedFilterIds();

        expect(result).toBeUndefined();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(VALIDATOR_DATA_FILE_NAME),
        );
    });

    it('throws on invalid JSON structure (missing rulesetIds)', async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({ version: '1.0.0' }),
        );

        const loadAllowedFilterIds = await importFresh();

        expect(() => loadAllowedFilterIds()).toThrow(
            expect.objectContaining({
                message: expect.stringContaining(VALIDATOR_DATA_FILE_NAME),
            }),
        );
    });

    it('returns a Set of filter IDs from valid data', async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({
                version: '4.0.0',
                rulesetIds: [1, 2, 3, 10, 50],
                rulesetMetadataKeys: ['key1'],
            }),
        );

        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        const loadAllowedFilterIds = await importFresh();
        const result = loadAllowedFilterIds();

        expect(result).toEqual(new Set([1, 2, 3, 10, 50]));
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining('5 filters allowed'),
        );
    });

    it('returns an empty Set when rulesetIds is empty', async () => {
        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({
                version: '4.0.0',
                rulesetIds: [],
                rulesetMetadataKeys: [],
            }),
        );

        vi.spyOn(console, 'info').mockImplementation(() => {});
        const loadAllowedFilterIds = await importFresh();
        const result = loadAllowedFilterIds();

        expect(result).toEqual(new Set());
    });
});
