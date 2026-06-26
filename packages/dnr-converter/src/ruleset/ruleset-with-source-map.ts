/**
 * @file Contains the RulesetWithSourceMap class and IRulesetWithSourceMap
 * interface for managing converted declarative rules with source maps,
 * hash maps, lazy loading, and full serialization.
 */

import * as v from 'valibot';

import { type DeclarativeRule, DeclarativeRuleValidator } from '../declarative-rule';
import { UnavailableFilterSourceError, UnavailableRulesetSourceError } from '../errors/unavailable-sources-errors';
import { type IFilter } from '../filter/types';
import { Rule } from '../rule/rule';
import { getErrorMessage } from '../utils/error';
import { LazyLoader } from '../utils/lazy-loader';
import { serializeJson } from '../utils/string';
import { strictObjectByType } from '../utils/valibot';

import { createMetadataRule } from './metadata-rule';
import { type IRulesHashMap } from './rules-hash-map';
import { type ISourceMap, SourceMap, type SourceRuleIdxAndFilterId } from './source-map';
import { type IBaseRuleset, type SourceRuleAndFilterId } from './types';

/**
 * Extended rule set interface for the advanced conversion flow
 * ({@link FilterConverter} with `withSourceMap: true`) with source-map support,
 * hash maps, lazy loading, and full serialization.
 */
export interface IRulesetWithSourceMap extends IBaseRuleset {
    /**
     * Returns a list of pairs of source text rules and their filter identifiers
     * for a given declarative rule identifier.
     *
     * @param declarativeRuleId {@link DeclarativeRule|declarative rule} Id.
     *
     * @returns Promise with list of source rules.
     *
     * @throws Error {@link UnavailableRulesetSourceError} if rule set source
     * is not available.
     */
    getRulesById(declarativeRuleId: number): Promise<SourceRuleAndFilterId[]>;

    /**
     * Returns list of network rules with `$badfilter` option.
     *
     * @returns List of network rules with `$badfilter` option.
     */
    getBadFilterRules(): Rule[];

    /**
     * Returns dictionary with hashes of all ruleset's source rules.
     *
     * @returns Dictionary with hashes of all ruleset's source rules.
     */
    getRulesHashMap(): IRulesHashMap;

    /**
     * For provided source returns list of ids of converted declarative rule.
     *
     * @param source Source rule index and filter id.
     *
     * @returns List of ids of converted declarative rule.
     */
    getDeclarativeRulesIdsBySourceRuleIndex(
        source: SourceRuleIdxAndFilterId,
    ): Promise<number[]>;

    /**
     * Returns list of ruleset's declarative rules (async, lazy loaded).
     *
     * @returns List of ruleset's declarative rules.
     */
    getDeclarativeRules(): Promise<DeclarativeRule[]>;

    /**
     * Contains unsafe declarative rules which is separate from ruleset
     * (async, lazy loaded).
     *
     * @returns List of unsafe declarative rules.
     */
    getUnsafeRules(): Promise<DeclarativeRule[]>;

    /**
     * Unload ruleset content.
     * This method can be used to free memory until the content is needed again.
     */
    unloadContent(): void;

    /**
     * Serializes rule set to a single file.
     *
     * @param unsafeRules List of unsafe rules to add to the serialized output.
     * Number of unsafe rules will be excluded from the counter of declarative
     * rules in the serialized metadata.
     * IMPORTANT: currently multiple filters in a single ruleset are not supported.
     * @param prettyPrint Whether to pretty print the output. Default is `true`.
     *
     * @returns Serialized rule set.
     *
     * @throws Error {@link UnavailableRulesetSourceError} if rule set source is not available.
     * @throws Error if counter of unsafe rules is not equal to the length of
     * the provided `unsafeRules` array.
     */
    serializeCompact(
        unsafeRules: DeclarativeRule[],
        prettyPrint?: boolean,
    ): Promise<string>;
}

/**
 * Rule set content's provider for lazy load data.
 */
export type RulesetContentProvider = {
    loadSourceMap: () => Promise<ISourceMap>;
    loadFilterList: () => Promise<IFilter[]>;
    loadDeclarativeRules: () => Promise<DeclarativeRule[]>;
};

/**
 * Valibot validator for {@link SerializedRulesetLazyData}.
 */
const serializedRuleSetLazyDataValidator = strictObjectByType<SerializedRulesetLazyData>({
    sourceMapRaw: v.string(),
    filterIds: v.array(v.number()),
});

/**
 * Serialized lazy data for a rule set.
 */
export type SerializedRulesetLazyData = {
    sourceMapRaw: string;
    filterIds: number[];
};

/**
 * Valibot validator for {@link SerializedRulesetData}.
 */
const serializedRuleSetDataValidator = strictObjectByType<SerializedRulesetData>({
    regexpRulesCount: v.number(),
    unsafeRulesCount: v.number(),
    safeRulesCount: v.number(),
    ruleSetHashMapRaw: v.string(),
    badFilterRulesRaw: v.array(v.string()),
    unsafeRules: v.array(DeclarativeRuleValidator),
});

/**
 * Serialized data for a rule set.
 */
export type SerializedRulesetData = {
    regexpRulesCount: number;
    unsafeRulesCount: number;
    safeRulesCount: number;
    ruleSetHashMapRaw: string;
    badFilterRulesRaw: string[];
    unsafeRules: DeclarativeRule[];
};

/**
 * A serialized rule set with primitive values separated into two parts: one is
 * needed for instant creating ruleset, while the other is needed only when
 * declarative filtering log is enabled - to find and display source rules from
 * raw filters.
 */
export type SerializedRuleset = {
    id: string;

    /**
     * Metadata needed for instant creating ruleset.
     */
    data: string;

    /**
     * Metadata needed for lazy load some data to ruleset to find and show
     * source rules when declarative filtering log is enabled.
     */
    lazyData: string;
};

/**
 * A deserialized rule set with loaded data and provider for lazy loading data.
 */
export type DeserializedRuleset = {
    id: string;

    /**
     * Metadata needed for instant creating ruleset.
     */
    data: SerializedRulesetData;

    /**
     * Metadata needed for lazy load some data to ruleset to find and show
     * source rules when declarative filtering log is enabled.
     */
    ruleSetContentProvider: RulesetContentProvider;
};

/**
 * Keeps converted declarative rules, counters of rules and source map for them.
 */
export class RulesetWithSourceMap implements IRulesetWithSourceMap {
    /**
     * Id of rule set.
     */
    private readonly id: string;

    /**
     * Array of converted declarative rules.
     */
    private declarativeRules: DeclarativeRule[] = [];

    /**
     * Number of safe declarative rules (unsafe rules are stored separately
     * and not counted here).
     *
     * This is needed for the lazy version of the rule set,
     * when content not loaded.
     */
    private readonly safeRulesCount: number = 0;

    /**
     * Converted declarative unsafe rules.
     */
    private readonly unsafeRulesCount: number = 0;

    /**
     * Array with unsafe declarative rules stored in the serialized metadata.
     *
     * This can be used to store unsafe rules inside metadata rule to use
     * "skip review" feature in CWS.
     *
     * {@link https://developer.chrome.com/docs/webstore/skip-review/}.
     */
    private readonly unsafeRules: DeclarativeRule[];

    /**
     * Converted declarative regexp rules.
     */
    private readonly regexpRulesCount: number = 0;

    /**
     * Source map for declarative rules.
     */
    private sourceMap: ISourceMap | undefined;

    /**
     * Dictionary which helps to fast find rule by its hash.
     */
    private rulesHashMap: IRulesHashMap;

    /**
     * List of network rules with $badfilter option.
     */
    private badFilterRules: Rule[];

    /**
     * Keeps array of source filter lists.
     */
    private filterList: Map<number, IFilter> = new Map();

    /**
     * The content provider of a rule set, is needed for lazy initialization.
     * If request the source rules from rule set, the content provider will be
     * called to load the source map, filter list and declarative rules list.
     */
    private readonly ruleSetContentProvider: RulesetContentProvider;

    /**
     * Lazy loader wrapping the content-provider call. Handles caching,
     * concurrent-call coalescing, and safe unload-during-load.
     */
    private readonly contentLoader: LazyLoader<void>;

    /**
     * Constructor of RulesetWithSourceMap.
     *
     * @param id Id of rule set.
     * @param safeRulesCount Number of safe declarative rules
     * (unsafe rules are tracked separately via {@link unsafeRulesCount}).
     * @param unsafeRulesCount Number of unsafe rules.
     * @param regexpRulesCount Number of regexp rules.
     * @param ruleSetContentProvider Rule set content provider.
     * @param badFilterRules List of rules with $badfilter modifier.
     * @param rulesHashMap Dictionary with hashes for all source rules.
     * @param unsafeRules List of unsafe DNR rules.
     */
    constructor(
        id: string,
        safeRulesCount: number,
        unsafeRulesCount: number,
        regexpRulesCount: number,
        ruleSetContentProvider: RulesetContentProvider,
        badFilterRules: Rule[],
        rulesHashMap: IRulesHashMap,
        unsafeRules: DeclarativeRule[],
    ) {
        this.id = id;
        this.safeRulesCount = safeRulesCount;
        this.unsafeRulesCount = unsafeRulesCount;
        this.regexpRulesCount = regexpRulesCount;
        this.ruleSetContentProvider = ruleSetContentProvider;
        this.badFilterRules = badFilterRules;
        this.rulesHashMap = rulesHashMap;
        this.unsafeRules = unsafeRules;
        this.contentLoader = new LazyLoader<void>(async () => {
            const {
                loadSourceMap,
                loadFilterList,
                loadDeclarativeRules,
            } = this.ruleSetContentProvider;

            this.sourceMap = await loadSourceMap();
            this.declarativeRules = await loadDeclarativeRules();
            // TODO: Find a better method to load filters (AG-42364)
            const filtersList = await loadFilterList();
            filtersList.forEach((filter: IFilter) => {
                this.filterList.set(filter.getId(), filter);
            });
        });
    }

    /** @inheritdoc */
    public getUnsafeRules(): Promise<DeclarativeRule[]> {
        return Promise.resolve(this.unsafeRules);
    }

    /** @inheritdoc */
    public getSafeRulesCount(): number {
        return this.safeRulesCount;
    }

    /** @inheritdoc */
    public getUnsafeRulesCount(): number {
        return this.unsafeRulesCount;
    }

    /** @inheritdoc */
    public getRegexpRulesCount(): number {
        return this.regexpRulesCount;
    }

    /** @inheritdoc */
    public getId(): string {
        return this.id;
    }

    /**
     * Returns a list of pairs of source text rules and their filter identifiers
     * for a given declarative rule identifier.
     *
     * @param declarativeRuleId {@link DeclarativeRule|declarative rule} Id.
     *
     * @returns Promise with list of source rules.
     *
     * @throws An error when filter is not found or filter content is unavailable.
     */
    private async findSourceRules(declarativeRuleId: number): Promise<SourceRuleAndFilterId[]> {
        if (!this.sourceMap) {
            return [];
        }

        const sourcePairs = this.sourceMap.getByDeclarativeRuleId(declarativeRuleId);
        const sourceRules = sourcePairs.map(async ({
            filterId,
            sourceRuleIndex,
        }) => {
            const filter = this.filterList.get(filterId);
            if (!filter) {
                throw new Error(`Not found filter list with id: ${filterId}`);
            }

            // `getRuleByIndex` is optional on IFilter — only filters used in
            // the source-map flow are expected to implement it. A filter
            // without it cannot resolve source rules by index, which is a
            // misconfiguration for this flow.
            if (!filter.getRuleByIndex) {
                // eslint-disable-next-line max-len
                const msg = `Filter with id ${filterId} does not implement getRuleByIndex and cannot be used in the source-map flow`;
                throw new UnavailableFilterSourceError(msg, filterId);
            }

            const sourceRule = await filter.getRuleByIndex(sourceRuleIndex);

            return {
                sourceRule,
                filterId,
            };
        });

        return Promise.all(sourceRules);
    }

    /**
     * Run inner lazy deserialization from rule set content provider to load
     * data which is not needed on the creation of rule set:
     * the source map, filter list and declarative rules list.
     *
     * @returns Promise resolving when the content has been loaded.
     */
    private loadContent(): Promise<void> {
        return this.contentLoader.get();
    }

    /** @inheritdoc */
    public unloadContent(): void {
        // Nothing to unload if content was never loaded and no load is pending.
        // Both checks are required: if we only checked `isLoaded()` we would
        // enter the clear branch below while a load is in flight and race
        // with the producer writing to `sourceMap`, `filterList`, and
        // `declarativeRules`.
        if (!this.contentLoader.isLoaded() && !this.contentLoader.isLoading()) {
            return;
        }

        // If a load is in flight, defer the full unload until it settles so
        // we don't race with the producer writing to `sourceMap`, `filterList`,
        // and `declarativeRules`.
        //
        // This defer-during-load dance is specific to `RulesetWithSourceMap`
        // because the producer writes to multiple external fields on `this`.
        // `Filter.unloadContent()` does not need it: `LazyLoader.reset()`
        // already handles defer-during-load for its own cached value, and
        // `Filter`'s only extra state (`ruleByOffset`) is rebuilt lazily on
        // the next `getRuleByIndex()` call, so clearing it is always safe.
        //
        // Fire-and-forget is acceptable because the deferred unload has no
        // observable consumers beyond ruleset state, and any producer error
        // is surfaced to the caller of `loadContent()`.
        if (this.contentLoader.isLoading()) {
            this.contentLoader.get()
                .finally(() => {
                    this.unloadContent();
                })
                .catch(() => {
                    // Empty on purpose. `.finally()` does not swallow
                    // rejections — it re-throws the producer error into this
                    // chain. Without `.catch()` that duplicate rejection
                    // would bubble up as an unhandled rejection, because
                    // nothing awaits this chain. The original error is still
                    // delivered to whoever awaited `loadContent()`.
                });
            return;
        }

        // Safely unload all filters in the filter list
        this.filterList.forEach((filter) => filter.unloadContent());

        // Clear loaded resources
        this.sourceMap = undefined;
        this.declarativeRules = [];
        this.filterList.clear();

        // Mark the content as unloaded
        this.contentLoader.reset();
    }

    /** @inheritdoc */
    public async getRulesById(declarativeRuleId: number): Promise<SourceRuleAndFilterId[]> {
        try {
            await this.loadContent();

            const originalRules = await this.findSourceRules(declarativeRuleId);

            return originalRules;
        } catch (e) {
            const id = this.getId();
            // eslint-disable-next-line max-len
            const msg = `Cannot extract source rule for given declarativeRuleId ${declarativeRuleId} in rule set '${id}', got error: ${getErrorMessage(e)}`;
            throw new UnavailableRulesetSourceError(msg, id, e as Error);
        }
    }

    /** @inheritdoc */
    public getBadFilterRules(): Rule[] {
        return this.badFilterRules;
    }

    /** @inheritdoc */
    public getRulesHashMap(): IRulesHashMap {
        return this.rulesHashMap;
    }

    /** @inheritdoc */
    public async getDeclarativeRulesIdsBySourceRuleIndex(
        source: SourceRuleIdxAndFilterId,
    ): Promise<number[]> {
        await this.loadContent();

        if (!this.sourceMap) {
            const { filterId, sourceRuleIndex } = source;
            // eslint-disable-next-line max-len
            throw new Error(`Cannot find declarative rules for filter id - ${filterId}, rule index - ${sourceRuleIndex} because source map is undefined in ruleset: ${this.getId()}`);
        }

        return this.sourceMap.getBySourceRuleIndex(source);
    }

    /** @inheritdoc */
    public async getDeclarativeRules(): Promise<DeclarativeRule[]> {
        await this.loadContent();

        return this.declarativeRules;
    }

    /**
     * For provided source rule and filter id return network rule.
     * This method is needed for checking the applicability of $badfilter after
     * a fast-check of rules by comparing only hashes. Afterward, we should
     * build the 'full' Network rule from provided source, not just the hash,
     * to determine the applicability of $badfilter.
     *
     * @param source Source rule and filter id.
     *
     * @returns List of {@link Rule | network rules}.
     */
    public static getRuleBySourceRule(
        source: SourceRuleAndFilterId,
    ): Rule[] {
        const { sourceRule, filterId } = source;

        try {
            return Rule.createFromText(
                filterId,
                // We don't need line index because this rule
                // will be used only for matching $badfilter rules.
                0,
                sourceRule,
            );
        } catch (e) {
            return [];
        }
    }

    /**
     * Deserializes rule set to primitives values with lazy load.
     *
     * @param id Id of rule set.
     * @param rawData An item of {@link SerializedRulesetData} for instant
     * creating ruleset. It contains counters for regular declarative and regexp
     * declarative rules, a map of hashes for all rules, and a list of rules
     * with the `$badfilter` modifier.
     * @param loadLazyData An item of {@link SerializedRulesetLazyData} for lazy
     * loading ruleset data to find and display source rules when declarative
     * filtering log is enabled. It includes a map of sources for all rules,
     * a list of declarative rules, and a list of source filter IDs.
     * @param loadDeclarativeRules Loader for ruleset's declarative rules from
     * raw file as a string.
     * @param filterList List of {@link IFilter}.
     *
     * @returns Deserialized rule set.
     *
     * @throws Error {@link UnavailableRulesetSourceError} if rule set source
     * is not available.
     */
    public static async deserialize(
        id: string,
        rawData: string,
        loadLazyData: () => Promise<string>,
        loadDeclarativeRules: () => Promise<string>,
        filterList: IFilter[],
    ): Promise<DeserializedRuleset> {
        let data: SerializedRulesetData;

        try {
            const objectFromString = JSON.parse(rawData);
            data = v.parse(serializedRuleSetDataValidator, objectFromString);
        } catch (e) {
            // eslint-disable-next-line max-len
            const msg = `Cannot parse serialized ruleset's data with id "${id}", got error: ${getErrorMessage(e)}`;

            throw new UnavailableRulesetSourceError(msg, id, e as Error);
        }

        /**
         * This variable is used as a singleton for all three functions
         * (`loadSourceMap`, `loadFilterList`, `loadDeclarativeRules`) to load
         * data only once.
         */
        let deserializedLazyData: SerializedRulesetLazyData | undefined;

        const getLazyData = async (): Promise<SerializedRulesetLazyData> => {
            if (deserializedLazyData !== undefined) {
                return deserializedLazyData;
            }

            try {
                const lazyData = await loadLazyData();

                const objectFromString = JSON.parse(lazyData);

                const parsed = v.parse(serializedRuleSetLazyDataValidator, objectFromString);
                deserializedLazyData = parsed;

                return parsed;
            } catch (e) {
                // eslint-disable-next-line max-len
                const msg = `Cannot parse or load data for lazy metadata for rule set with id "${id}": ${getErrorMessage(e)}`;

                throw new UnavailableRulesetSourceError(msg, id, e as Error);
            }
        };

        const deserialized: DeserializedRuleset = {
            id,
            data,
            ruleSetContentProvider: {
                loadSourceMap: async () => {
                    const { sourceMapRaw } = await getLazyData();
                    const sources = SourceMap.deserializeSources(sourceMapRaw);

                    return new SourceMap(sources);
                },
                loadFilterList: async () => {
                    const { filterIds } = await getLazyData();

                    return filterList.filter((filter: IFilter) => filterIds.includes(filter.getId()));
                },
                loadDeclarativeRules: async () => {
                    const rawFileContent = await loadDeclarativeRules();

                    const objectFromString = JSON.parse(rawFileContent);

                    const declarativeRules = v.parse(
                        v.array(DeclarativeRuleValidator),
                        objectFromString,
                    );

                    return declarativeRules;
                },
            },
        };

        return deserialized;
    }

    /**
     * Helper method to get serialized rule set data.
     *
     * @param unsafeRules List of unsafe rules to add to the serialized output.
     *
     * @returns Serialized rule set data.
     */
    private getSerializedRuleSetData(unsafeRules: DeclarativeRule[]): SerializedRulesetData {
        return {
            regexpRulesCount: this.regexpRulesCount,
            unsafeRulesCount: this.unsafeRulesCount,
            // `safeRulesCount` in serialized data represents safe declarative
            // rules only — unsafe rules are tracked in `unsafeRulesCount`
            // and stored in the `unsafeRules` array (metadata).
            safeRulesCount: this.safeRulesCount,
            ruleSetHashMapRaw: this.rulesHashMap.serialize(),
            badFilterRulesRaw: this.badFilterRules.map((r) => r.getText()),
            unsafeRules,
        };
    }

    /**
     * Helper method to get serialized rule set lazy data.
     *
     * @returns Serialized rule set lazy data.
     */
    private getSerializedRuleSetLazyData(): SerializedRulesetLazyData {
        return {
            sourceMapRaw: this.sourceMap?.serialize() || '',
            filterIds: Array.from(this.filterList.keys()),
        };
    }

    /** @inheritdoc */
    public async serializeCompact(
        unsafeRules: DeclarativeRule[],
        prettyPrint = true,
    ): Promise<string> {
        try {
            await this.loadContent();
        } catch (e) {
            const id = this.getId();
            // eslint-disable-next-line max-len
            const msg = `Cannot serialize ruleset '${id}' because of not available source, got error: ${getErrorMessage(e)}`;
            throw new UnavailableRulesetSourceError(msg, id, e as Error);
        }

        // TODO: Improve this code once we introduce multiple filters within a single ruleset.
        // Also, do not forget to change metadata rule's structure to store preprocessed
        // filter lists in an array.
        // Currently, we expect that there is only one filter within a single rule set.
        const filter = this.filterList.values().next().value;

        if (!filter) {
            const id = this.getId();
            const msg = `Cannot serialize ruleset '${id}' because of not available filter list`;
            throw new UnavailableRulesetSourceError(msg, id);
        }

        const content = await filter.getContent();

        // Validate the provided unsafe rules against the stored count.
        //
        // Two valid states are intentionally supported:
        //  - Non-empty `unsafeRules`: used by the unsafe-rule post-pass (see
        //    `@adguard/dnr-rulesets`) which moves unsafe rules out of the
        //    declarative list into metadata. Here the length MUST equal
        //    `unsafeRulesCount`.
        //  - Empty `unsafeRules` (`[]`): used at the initial CLI conversion
        //    stage, where no unsafe rules are excluded yet — the count is still
        //    recorded in `unsafeRulesCount` for capacity tracking, but the
        //    metadata stores an empty set until the post-pass runs.
        //
        // The check therefore only rejects a mismatch when a non-empty array is
        // provided; an empty array is always allowed (initial conversion).
        if (unsafeRules.length > 0 && unsafeRules.length !== this.unsafeRulesCount) {
            const id = this.getId();
            // eslint-disable-next-line max-len
            const msg = `Unsafe rules count is not equal to the length of provided unsafe rules array in rule set '${id}'`;
            throw new Error(msg);
        }

        const metadataRule = createMetadataRule({
            metadata: this.getSerializedRuleSetData(unsafeRules),
            lazyMetadata: this.getSerializedRuleSetLazyData(),
            filterContent: content,
        });

        // Insert metadata rule at the beginning of the rules array without
        // "unshifting" it to avoid mutating the internal state of the RuleSet,
        // which could lead to issues if serializeCompact is called multiple times.
        let declarativeRules: DeclarativeRule[] = [];
        declarativeRules = declarativeRules.concat(metadataRule);

        const convertedRules = await this.getDeclarativeRules();
        declarativeRules = declarativeRules.concat(convertedRules);

        // Exclude unsafe rules from declarative rules if any are provided.
        if (unsafeRules.length > 0) {
            const unsafeRulesIds = new Set(unsafeRules.map((rule) => rule.id));

            declarativeRules = declarativeRules.filter((rule) => {
                return !unsafeRulesIds.has(rule.id);
            });
        }

        const result = serializeJson(declarativeRules, prettyPrint);

        return result;
    }
}
