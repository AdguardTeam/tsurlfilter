import { createHash } from 'node:crypto';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import {
    type CompactRulesetContent,
    Filter,
    FilterConverter,
    getRulesetId,
    getRulesetPath,
    InvalidMetadataChunksError,
    type IRulesetWithSourceMap,
    isSafeRule,
    METADATA_RULESET_ID,
    MetadataRuleset,
    parseCompactRuleset,
    RulesetWithSourceMap,
} from '@adguard/dnr-converter';
import { fetchExtensionResourceText, FilterList } from '@adguard/tsurlfilter';

import { IdbSingleton } from '../../../../src/lib/common/idb-singleton';
import { FiltersStorage } from '../../../../src/lib/common/storage/filters';
import { TsWebExtension } from '../../../../src/lib/mv3/background/app';
import { RulesetsLoaderApi } from '../../../../src/lib/mv3/background/rulesets-loader-api';

vi.mock('@adguard/tsurlfilter', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;

    return {
        ...actual,
        fetchExtensionResourceText: vi.fn(),
    };
});

const RULESETS_STORE = 'rulesets';
const FILTERS_STORE = 'filters';
const FILTER_ID = 1;
const RULESET_ID = getRulesetId(FILTER_ID);
const LARGE_FILTER_ID = 2;
const LARGE_RULESET_ID = getRulesetId(LARGE_FILTER_ID);
const METADATA_RULESET = getRulesetId(METADATA_RULESET_ID);

/**
 * Prefixes of the keys the loader writes to the rulesets store. They are
 * spelled out here on purpose: they are the persisted format.
 */
type RulesetKeyPrefix = 'checksum' | 'metadata' | 'lazyMetadata' | 'declarativeRules' | 'metadataRulesCount';

/**
 * Ruleset files served by the mocked `fetchExtensionResourceText`, by their
 * path inside the rulesets directory.
 */
const files = new Map<string, string>();

/**
 * Directory of the rulesets. Every test starts with a new one, so the static
 * in-memory caches of {@link RulesetsLoaderApi}, which are keyed by this
 * path, start empty while IndexedDB keeps its data.
 */
let rulesetsPath = '';
let rulesetsPathCounter = 0;

/**
 * Serves the same files from a new rulesets directory, as after a service
 * worker restart.
 */
const useNewRulesetsPath = (): void => {
    rulesetsPathCounter += 1;
    rulesetsPath = `rulesets-${rulesetsPathCounter}`;
};

/**
 * Returns the rules of a filter list with enough distinct rules for its
 * metadata to span several metadata rules.
 *
 * @param count Number of blocking rules.
 *
 * @returns Filter list rules.
 */
const getLargeFilterRules = (count: number): string[] => {
    return Array.from({ length: count }, (_, i) => `||example-${i}.org^`);
};

/**
 * Filter list with a `$badfilter` rule, an allowlist rule and an unsafe rule.
 */
const SMALL_FILTER_RULES = [
    '||example.org^',
    '||example.org^$badfilter',
    '@@||example.com^',
    '||example.net^$removeparam=utm_source',
];

/**
 * Returns the source filter of {@link SMALL_FILTER_RULES}.
 *
 * @returns Filter with id {@link FILTER_ID}.
 */
const createSmallFilter = (): Filter => {
    return new Filter(FILTER_ID, SMALL_FILTER_RULES.join('\n'));
};

/**
 * Converts a filter list to a ruleset file the way the rulesets build does:
 * conversion, then, when `excludeUnsafe` is set, the unsafe-rule post-pass
 * that moves unsafe rules into the metadata.
 *
 * @param filterId Filter id.
 * @param rules Filter list rules.
 * @param excludeUnsafe Whether to move unsafe rules into the metadata.
 *
 * @returns Content of the ruleset file.
 */
const buildRulesetFile = async (
    filterId: number,
    rules: string[],
    excludeUnsafe = false,
): Promise<string> => {
    const [{ ruleset }] = await new FilterConverter().convert(
        [new Filter(filterId, rules.join('\n'))],
        { resourcesPath: '/war/redirects', withSourceMap: true },
    );

    if (!excludeUnsafe) {
        return ruleset.serializeCompact([], false);
    }

    const unsafeRules = (await ruleset.getDeclarativeRules()).filter((rule) => !isSafeRule(rule));

    return ruleset.serializeCompact(unsafeRules, false);
};

/**
 * Serves ruleset files and a `ruleset_0` with their checksums.
 *
 * @param rulesets Ruleset file contents by ruleset id.
 *
 * @returns Checksums written to `ruleset_0`, by ruleset id.
 */
const serveRulesets = (rulesets: Record<string, string>): Record<string, string> => {
    const checksums: Record<string, string> = {};

    for (const [rulesetId, content] of Object.entries(rulesets)) {
        files.set(getRulesetPath(rulesetId), content);
        checksums[rulesetId] = createHash('md5').update(content).digest('hex');
    }

    files.set(getRulesetPath(METADATA_RULESET_ID), new MetadataRuleset(checksums).serialize());

    return checksums;
};

/**
 * Returns the content of a served ruleset file as read by the converter.
 *
 * @param rulesetId Ruleset id.
 *
 * @returns Parsed ruleset file.
 */
const readServedRuleset = (rulesetId = RULESET_ID): CompactRulesetContent => {
    return parseCompactRuleset(rulesetId, JSON.parse(files.get(getRulesetPath(rulesetId))!));
};

/**
 * Returns how many times the ruleset file was fetched from the current
 * rulesets directory.
 *
 * @param rulesetId Ruleset id.
 *
 * @returns Number of fetches.
 */
const countFetches = (rulesetId: string): number => {
    const path = getRulesetPath(rulesetId, rulesetsPath);

    return vi.mocked(fetchExtensionResourceText).mock.calls.filter(([url]) => url === path).length;
};

/**
 * Returns the key of a rulesets store entry.
 *
 * @param prefix Key prefix.
 * @param rulesetId Ruleset id.
 *
 * @returns Key.
 */
const rulesetKey = (prefix: RulesetKeyPrefix, rulesetId = RULESET_ID): string => {
    return `${prefix}_${rulesetId}`;
};

/**
 * Reads a value from a store of the tswebextension IndexedDB.
 *
 * @param store Store name.
 * @param key Key.
 *
 * @returns Stored value or `undefined`.
 */
const readIdb = async (store: string, key: string): Promise<unknown> => {
    const db = await IdbSingleton.getOpenedDb(store);

    return db.get(store, key);
};

/**
 * Writes a value to a store of the tswebextension IndexedDB.
 *
 * @param store Store name.
 * @param key Key.
 * @param value Value.
 */
const writeIdb = async (store: string, key: string, value: unknown): Promise<void> => {
    const db = await IdbSingleton.getOpenedDb(store);

    await db.put(store, value, key);
};

/**
 * Reads a rulesets store entry that the loader writes as a JSON string.
 *
 * @param prefix Key prefix.
 *
 * @returns Parsed value.
 */
const readRulesetJson = async (prefix: RulesetKeyPrefix): Promise<unknown> => {
    return JSON.parse(await readIdb(RULESETS_STORE, rulesetKey(prefix)) as string);
};

/**
 * Checks that IndexedDB holds the ruleset data and the filter list of the
 * served ruleset file.
 *
 * @param checksum Checksum of the file.
 */
const expectCachedRuleset = async (checksum: string): Promise<void> => {
    const content = readServedRuleset();

    expect(await readRulesetJson('declarativeRules')).toEqual(content.declarativeRules);
    expect(await readRulesetJson('metadata')).toEqual(content.metadata);
    expect(await readRulesetJson('lazyMetadata')).toEqual(content.lazyMetadata);
    expect(await readIdb(RULESETS_STORE, rulesetKey('metadataRulesCount'))).toBe(content.metadataRulesCount);
    expect(await readIdb(RULESETS_STORE, rulesetKey('checksum'))).toBe(checksum);

    const filterList = new FilterList(content.filterContent);
    expect(await FiltersStorage.get(FILTER_ID)).toEqual({
        rawFilterList: filterList.getContent(),
        conversionData: filterList.getConversionData(),
        checksum,
    });
};

/**
 * Builds the ruleset straight from its served file, for comparison with the
 * ruleset from the loader.
 *
 * @param filter Source filter of the ruleset.
 *
 * @returns Expected ruleset.
 */
const rulesetFromFile = (filter: Filter): RulesetWithSourceMap => {
    return RulesetWithSourceMap.fromCompact(RULESET_ID, readServedRuleset(), [filter]);
};

/**
 * Checks that a ruleset from the loader behaves like the expected ruleset
 * built straight from the file.
 *
 * @param actual Ruleset from the loader.
 * @param expected Expected ruleset.
 */
const expectSameRuleset = async (
    actual: IRulesetWithSourceMap,
    expected: IRulesetWithSourceMap,
): Promise<void> => {
    expect(actual.getSafeRulesCount()).toBe(expected.getSafeRulesCount());
    expect(actual.getUnsafeRulesCount()).toBe(expected.getUnsafeRulesCount());
    expect(actual.getRegexpRulesCount()).toBe(expected.getRegexpRulesCount());
    expect(await actual.getUnsafeRules()).toEqual(await expected.getUnsafeRules());
    expect(actual.getBadFilterRules().map((rule) => rule.getText()))
        .toEqual(expected.getBadFilterRules().map((rule) => rule.getText()));

    const declarativeRules = await actual.getDeclarativeRules();
    expect(declarativeRules).toEqual(await expected.getDeclarativeRules());

    for (const { id } of declarativeRules) {
        // eslint-disable-next-line no-await-in-loop
        expect(await actual.getRulesById(id)).toEqual(await expected.getRulesById(id));
    }
};

/**
 * Checks that reading a ruleset failed on its metadata: the message names the
 * ruleset, asks to update the rule sets and repeats the converter's reason,
 * which is also kept as `cause`.
 *
 * @param reading Promise of the read that must fail.
 * @param rulesetId Id of the ruleset that could not be read.
 */
const expectMetadataReadError = async (reading: Promise<unknown>, rulesetId: string): Promise<void> => {
    const error = await reading.then(() => null, (e: Error) => e);

    const hint = `Rule set ${rulesetId} has invalid or unsupported metadata, update the rule sets`;

    expect(error?.cause).toBeInstanceOf(InvalidMetadataChunksError);
    expect(error?.message).toBe(`${hint}: ${(error?.cause as Error).message}`);
};

/**
 * Returns a ruleset file in the old format with one metadata rule that
 * carries the whole metadata.
 *
 * @param content Content of a ruleset in the current format.
 *
 * @returns Content of the old-format file.
 */
const toLegacyRulesetFile = (content: CompactRulesetContent): string => {
    return JSON.stringify([
        {
            id: 1,
            action: { type: 'block' },
            condition: { urlFilter: 'dummy.rule.adguard.com', resourceTypes: ['xmlhttprequest'] },
            metadata: {
                metadata: content.metadata,
                lazyMetadata: content.lazyMetadata,
                filterContent: content.filterContent,
            },
        },
        ...content.declarativeRules,
    ]);
};

beforeEach(async () => {
    vi.restoreAllMocks();
    files.clear();
    useNewRulesetsPath();

    vi.mocked(fetchExtensionResourceText).mockReset();
    vi.mocked(fetchExtensionResourceText).mockImplementation(async (url: string) => {
        // Drop the rulesets directory: the same files are served from any.
        const content = files.get(url.slice(url.indexOf('/') + 1));
        if (content === undefined) {
            throw new Error(`No file at ${url}`);
        }

        return content;
    });
    vi.spyOn(browser.runtime, 'getURL').mockImplementation((path: string) => path);

    for (const store of [RULESETS_STORE, FILTERS_STORE]) {
        // eslint-disable-next-line no-await-in-loop
        const db = await IdbSingleton.getOpenedDb(store);
        // eslint-disable-next-line no-await-in-loop
        await db.clear(store);
    }
});

describe('RulesetsLoaderApi', () => {
    describe('syncRulesetWithIdb', () => {
        it('caches a multi-chunk ruleset without its metadata rules', async () => {
            const checksums = serveRulesets({
                [RULESET_ID]: await buildRulesetFile(FILTER_ID, getLargeFilterRules(3000)),
            });
            expect(readServedRuleset().metadataRulesCount).toBeGreaterThan(1);

            await new RulesetsLoaderApi(rulesetsPath).syncRulesetWithIdb(RULESET_ID);

            await expectCachedRuleset(checksums[RULESET_ID]);
        });

        it('keeps the old checksum when writing the filter data fails and syncs again later', async () => {
            await writeIdb(RULESETS_STORE, rulesetKey('checksum'), 'old-checksum');
            const checksums = serveRulesets({ [RULESET_ID]: await buildRulesetFile(FILTER_ID, SMALL_FILTER_RULES) });
            const loader = new RulesetsLoaderApi(rulesetsPath);
            vi.spyOn(FiltersStorage, 'setMultiple').mockRejectedValueOnce(new Error('QuotaExceededError'));

            await expect(loader.syncRulesetWithIdb(RULESET_ID)).rejects.toThrow('QuotaExceededError');

            expect(await readIdb(RULESETS_STORE, rulesetKey('checksum'))).toBe('old-checksum');
            expect(await readIdb(RULESETS_STORE, rulesetKey('metadataRulesCount'))).toBeUndefined();

            await loader.syncRulesetWithIdb(RULESET_ID);

            expect(countFetches(RULESET_ID)).toBe(2);
            await expectCachedRuleset(checksums[RULESET_ID]);
        });

        it('rejects a filter ruleset in the old format and writes nothing', async () => {
            serveRulesets({ [RULESET_ID]: await buildRulesetFile(FILTER_ID, SMALL_FILTER_RULES) });
            serveRulesets({ [RULESET_ID]: toLegacyRulesetFile(readServedRuleset()) });

            await expectMetadataReadError(
                new RulesetsLoaderApi(rulesetsPath).syncRulesetWithIdb(RULESET_ID),
                RULESET_ID,
            );
            expect(await readIdb(RULESETS_STORE, rulesetKey('checksum'))).toBeUndefined();
            expect(await readIdb(RULESETS_STORE, rulesetKey('metadataRulesCount'))).toBeUndefined();
            expect(await FiltersStorage.get(FILTER_ID)).toBeUndefined();
        });

        it('rejects a ruleset_0 in the old format', async () => {
            serveRulesets({ [RULESET_ID]: await buildRulesetFile(FILTER_ID, SMALL_FILTER_RULES) });
            files.set(getRulesetPath(METADATA_RULESET_ID), JSON.stringify([{
                id: 1,
                action: { type: 'block' },
                condition: { urlFilter: 'dummy.rule.adguard.com', resourceTypes: ['xmlhttprequest'] },
                metadata: { checksums: {}, additionalProperties: {} },
            }]));

            await expectMetadataReadError(
                new RulesetsLoaderApi(rulesetsPath).syncRulesetWithIdb(RULESET_ID),
                METADATA_RULESET,
            );
        });
    });

    describe('createRuleset', () => {
        it('creates a ruleset that behaves like the one built from the file', async () => {
            serveRulesets({ [RULESET_ID]: await buildRulesetFile(FILTER_ID, SMALL_FILTER_RULES, true) });
            const filter = createSmallFilter();
            const expected = rulesetFromFile(filter);

            const actual = await new RulesetsLoaderApi(rulesetsPath).createRuleset(RULESET_ID, [filter]);

            expect(expected.getUnsafeRulesCount()).toBeGreaterThan(0);
            expect(expected.getBadFilterRules()).toHaveLength(1);
            expect(actual.getMetadataRulesCount()).toBe(1);
            await expectSameRuleset(actual, expected);
        });

        it('reports the number of metadata rules of a multi-chunk ruleset', async () => {
            const rules = getLargeFilterRules(3000);
            serveRulesets({ [RULESET_ID]: await buildRulesetFile(FILTER_ID, rules) });
            const filter = new Filter(FILTER_ID, rules.join('\n'));
            const { metadataRulesCount } = readServedRuleset();
            const expected = rulesetFromFile(filter);

            const actual = await new RulesetsLoaderApi(rulesetsPath).createRuleset(RULESET_ID, [filter]);

            expect(metadataRulesCount).toBeGreaterThan(1);
            expect(actual.getMetadataRulesCount()).toBe(metadataRulesCount);
            expect(actual.getSafeRulesCount()).toBe(rules.length);
            await expectSameRuleset(actual, expected);
        });

        it('creates a ruleset without ordinary rules', async () => {
            serveRulesets({ [RULESET_ID]: await buildRulesetFile(FILTER_ID, ['! comment only']) });

            const ruleset = await new RulesetsLoaderApi(rulesetsPath).createRuleset(
                RULESET_ID,
                [new Filter(FILTER_ID, '! comment only')],
            );

            expect(ruleset.getMetadataRulesCount()).toBe(1);
            expect(await ruleset.getDeclarativeRules()).toEqual([]);
        });

        it('rebuilds data cached by an older version and keeps unrelated data', async () => {
            const oldFilterList = new FilterList('||old.example^');
            await writeIdb(RULESETS_STORE, rulesetKey('checksum'), 'old-checksum');
            await writeIdb(RULESETS_STORE, rulesetKey('metadata'), '{"old":true}');
            await writeIdb(RULESETS_STORE, rulesetKey('lazyMetadata'), '{"old":true}');
            await writeIdb(RULESETS_STORE, rulesetKey('declarativeRules'), '[{"id":1,"metadata":{}}]');
            await writeIdb(RULESETS_STORE, 'unrelated_key', 'unrelated value');
            await FiltersStorage.setMultiple({
                [FILTER_ID]: {
                    rawFilterList: oldFilterList.getContent(),
                    conversionData: oldFilterList.getConversionData(),
                    checksum: 'old-checksum',
                },
            });
            await writeIdb('unrelated_store', 'key', 'unrelated value');
            const checksums = serveRulesets({ [RULESET_ID]: await buildRulesetFile(FILTER_ID, SMALL_FILTER_RULES) });

            const ruleset = await new RulesetsLoaderApi(rulesetsPath).createRuleset(
                RULESET_ID,
                [createSmallFilter()],
            );

            expect(ruleset.getMetadataRulesCount()).toBe(readServedRuleset().metadataRulesCount);
            await expectCachedRuleset(checksums[RULESET_ID]);
            expect(await readIdb(RULESETS_STORE, 'unrelated_key')).toBe('unrelated value');
            expect(await readIdb('unrelated_store', 'key')).toBe('unrelated value');
        });

        it('creates the ruleset from IndexedDB after a service worker restart', async () => {
            serveRulesets({ [RULESET_ID]: await buildRulesetFile(FILTER_ID, SMALL_FILTER_RULES, true) });
            const filter = createSmallFilter();
            await new RulesetsLoaderApi(rulesetsPath).createRuleset(RULESET_ID, [filter]);

            useNewRulesetsPath();
            const actual = await new RulesetsLoaderApi(rulesetsPath).createRuleset(RULESET_ID, [filter]);

            expect(countFetches(RULESET_ID)).toBe(0);
            expect(actual.getMetadataRulesCount()).toBe(1);
            await expectSameRuleset(actual, rulesetFromFile(filter));
        });

        it('fails when the metadata rules count is missing', async () => {
            serveRulesets({ [RULESET_ID]: await buildRulesetFile(FILTER_ID, SMALL_FILTER_RULES) });
            await new RulesetsLoaderApi(rulesetsPath).syncRulesetWithIdb(RULESET_ID);
            const db = await IdbSingleton.getOpenedDb(RULESETS_STORE);
            await db.delete(RULESETS_STORE, rulesetKey('metadataRulesCount'));

            useNewRulesetsPath();

            await expect(new RulesetsLoaderApi(rulesetsPath).createRuleset(RULESET_ID, [createSmallFilter()]))
                .rejects.toThrow(
                    `Metadata rules count of rule set ${RULESET_ID} is missing in IDB, `
                    + 'the cache may be built from rule sets with metadata in an old format, update the rule sets',
                );
        });
    });
});

// Tested here because it reuses the ruleset files and IndexedDB setup above.
describe('TsWebExtension.loadStaticRulesets', () => {
    it('reports the number of metadata rules of every manifest ruleset, enabled or not', async () => {
        const largeRules = getLargeFilterRules(3000);
        serveRulesets({
            [RULESET_ID]: await buildRulesetFile(FILTER_ID, SMALL_FILTER_RULES),
            [LARGE_RULESET_ID]: await buildRulesetFile(LARGE_FILTER_ID, largeRules),
        });
        vi.mocked(browser.runtime.getManifest).mockReturnValueOnce({
            manifest_version: 3,
            name: 'test',
            version: '1.0.0',
            declarative_net_request: {
                rule_resources: [METADATA_RULESET, RULESET_ID, LARGE_RULESET_ID].map((id) => ({
                    id,
                    enabled: false,
                    path: getRulesetPath(id, rulesetsPath),
                })),
            },
        });

        // Only filter 1 is enabled; the large ruleset is still created for its
        // counters. `loadStaticRulesets` is private: `configure()` would need
        // the whole MV3 runtime just to reach it.
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const staticRulesets = await TsWebExtension['loadStaticRulesets'](rulesetsPath, [createSmallFilter()]);

        expect(staticRulesets.map((ruleset) => [ruleset.getId(), ruleset.getMetadataRulesCount()])).toEqual([
            [RULESET_ID, 1],
            [LARGE_RULESET_ID, readServedRuleset(LARGE_RULESET_ID).metadataRulesCount],
        ]);
        expect(staticRulesets[1].getSafeRulesCount()).toBe(largeRules.length);
    });
});
