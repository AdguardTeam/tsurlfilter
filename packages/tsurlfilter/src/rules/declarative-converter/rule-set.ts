import { z as zod } from 'zod';
import { RuleParser } from '@adguard/agtree/parser';
import { RuleGenerator } from '@adguard/agtree/generator';

import type { NetworkRule } from '../network-rule';
import { getErrorMessage } from '../../common/error';
import { EMPTY_STRING } from '../../common/constants';
import { serializeJson } from '../../utils/misc';

import { IndexedNetworkRuleWithHash } from './network-indexed-rule-with-hash';
import { type DeclarativeRule, DeclarativeRuleValidator } from './declarative-rule';
import { type IFilter } from './filter';
import { UnavailableRuleSetSourceError } from './errors/unavailable-sources-errors/unavailable-rule-set-source-error';
import { type ISourceMap, SourceMap, type SourceRuleIdxAndFilterId } from './source-map';
import { type IRulesHashMap } from './rules-hash-map';
import { createMetadataRule } from './metadata-rule';

/**
 * The OriginalSource contains the text of the original rule and the filter
 * identifier of that rule.
 */
export type SourceRuleAndFilterId = {
    sourceRule: string;
    filterId: number;
};

/**
 * Describes object of ruleset id with list of ids of declarative rules. Needs
 * to disable declarative rules from static ruleset by applying $badfilter rules
 * from dynamic rulesets.
 */
export type UpdateStaticRulesOptions = {
    rulesetId: string;
    disableRuleIds: number[];
};

/**
 * Keeps converted declarative rules and source map for it.
 */
export interface IRuleSet {
    /**
     * Number of converted declarative rules.
     *
     * @returns Number of converted declarative rules.
     */
    getRulesCount(): number;

    /**
     * Number of converted declarative unsafe rules.
     *
     * @returns Number of converted declarative unsafe rules.
     */
    getUnsafeRulesCount(): number;

    /**
     * Number of converted declarative regexp rules.
     *
     * @returns Number of converted declarative regexp rules.
     */
    getRegexpRulesCount(): number;

    /**
     * Returns rule set id.
     *
     * @returns Rule set id.
     */
    getId(): string;

    /**
     * Returns a list of pairs of source text rules and their filter identifiers
     * for a given declarative rule identifier.
     *
     * @param declarativeRuleId {@link DeclarativeRule|declarative rule} Id.
     *
     * @returns Promise with list of source rules.
     *
     * @throws Error {@link UnavailableRuleSetSourceError} if rule set source
     * is not available.
     */
    getRulesById(declarativeRuleId: number): Promise<SourceRuleAndFilterId[]>;

    /**
     * Returns list of network rules with `$badfilter` option.
     *
     * @returns List of network rules with `$badfilter` option.
     */
    getBadFilterRules(): IndexedNetworkRuleWithHash[];

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
     * Returns list of ruleset's declarative rules.
     *
     * @returns List of ruleset's declarative rules.
     */
    getDeclarativeRules(): Promise<DeclarativeRule[]>;

    /**
     * Contains unsafe declarative rules which is separate from ruleset.
     */
    getUnsafeRules(): Promise<DeclarativeRule[]>;

    /**
     * Unload ruleset content.
     * This method can be used to free memory until the content is needed again.
     */
    unloadContent(): void;

    /**
     * Serializes rule set to primitives values with lazy load.
     *
     * TODO: Replace this method with `serializeCompact` method, because this
     * one is not used in the codebase.
     *
     * @deprecated
     *
     * @returns Serialized rule set.
     *
     * @throws Error {@link UnavailableRuleSetSourceError} if rule set source
     * is not available.
     */
    serialize(): Promise<SerializedRuleSet>;

    /**
     * Serializes rule set to a single file.
     *
     * @param prettyPrint Whether to pretty print the output. Default is `true`.
     * @param unsafeRules Optional list of unsafe rules to add to the serialized
     * output. If this parameter is provided, number of unsafe rules will be
     * excluded from the counter of declarative rules in the serialized metadata.
     *
     * IMPORTANT: currently multiple filters in a single ruleset are not supported.
     *
     * @returns Serialized rule set.
     *
     * @throws Error {@link UnavailableRuleSetSourceError} if rule set source is not available.
     * @throws Error if counter of unsafe rules is not equal to the length of
     * the provided `unsafeRules` array.
     */
    serializeCompact(
        prettyPrint?: boolean,
        unsafeRules?: DeclarativeRule[],
    ): Promise<string>;
}

/**
 * Rule set content's provider for lazy load data.
 */
export type RuleSetContentProvider = {
    loadSourceMap: () => Promise<ISourceMap>;
    loadFilterList: () => Promise<IFilter[]>;
    loadDeclarativeRules: () => Promise<DeclarativeRule[]>;
};

const serializedRuleSetLazyDataValidator = zod.strictObject({
    sourceMapRaw: zod.string(),
    filterIds: zod.number().array(),
});

export type SerializedRuleSetLazyData = zod.infer<typeof serializedRuleSetLazyDataValidator>;

const serializedRuleSetDataValidator = zod.strictObject({
    regexpRulesCount: zod.number(),
    unsafeRulesCount: zod.number(),
    rulesCount: zod.number(),
    ruleSetHashMapRaw: zod.string(),
    badFilterRulesRaw: zod.string().array(),
    unsafeRules: DeclarativeRuleValidator.array().optional(),
});

export type SerializedRuleSetData = zod.infer<typeof serializedRuleSetDataValidator>;

/**
 * A serialized rule set with primitive values separated into two parts: one is
 * needed for instant creating ruleset, while the other is needed only when
 * declarative filtering log is enabled - to find and display source rules from
 * raw filters.
 */
export type SerializedRuleSet = {
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
export type DeserializedRuleSet = {
    id: string;

    /**
     * Metadata needed for instant creating ruleset.
     */
    data: SerializedRuleSetData;

    /**
     * Metadata needed for lazy load some data to ruleset to find and show
     * source rules when declarative filtering log is enabled.
     */
    ruleSetContentProvider: RuleSetContentProvider;
};

/**
 * Keeps converted declarative rules, counters of rules and source map for them.
 */
export class RuleSet implements IRuleSet {
    /**
     * Id of rule set.
     */
    private readonly id: string;

    /**
     * Array of converted declarative rules.
     */
    private declarativeRules: DeclarativeRule[] = [];

    /**
     * Number of converted declarative rules.
     *
     * This is needed for the lazy version of the rule set,
     * when content not loaded.
     */
    private readonly rulesCount: number = 0;

    /**
     * Converted declarative unsafe rules.
     */
    private readonly unsafeRulesCount: number = 0;

    /**
     * Array with unsafe declarative rules, which can be optionally provided
     * when creating a ruleset.
     *
     * This can be used to store unsafe rules inside metadata rule to use
     * "skip review" feature in CWS.
     *
     * It's marked as optional to keep backward compatibility with old rulesets.
     *
     * {@link https://developer.chrome.com/docs/webstore/skip-review/}.
     *
     * @todo TODO: Mark this field as required in the next major version.
     */
    private readonly unsafeRules?: DeclarativeRule[];

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
    private badFilterRules: IndexedNetworkRuleWithHash[];

    /**
     * Keeps array of source filter lists
     * TODO: ? May it leads to memory leaks,
     * because one FilterList with its content
     * can be in the several RuleSet's at the same time ?
     */
    private filterList: Map<number, IFilter> = new Map();

    /**
     * The content provider of a rule set, is needed for lazy initialization.
     * If request the source rules from rule set, the content provider will be
     * called to load the source map, filter list and declarative rules list.
     */
    private readonly ruleSetContentProvider: RuleSetContentProvider;

    /**
     * Whether the content is loaded or not.
     */
    private initialized: boolean = false;

    /**
     * Waiter for initialization, will be resolved when the content is loaded.
     */
    private initializerPromise: Promise<void> | undefined;

    /**
     * Constructor of RuleSet.
     *
     * @param id Id of rule set.
     * @param rulesCount Number of rules.
     * @param unsafeRulesCount Number of unsafe rules.
     * @param regexpRulesCount Number of regexp rules.
     * @param ruleSetContentProvider Rule set content provider.
     * @param badFilterRules List of rules with $badfilter modifier.
     * @param rulesHashMap Dictionary with hashes for all source rules.
     * @param unsafeRules List of unsafe DNR rules.
     */
    constructor(
        id: string,
        rulesCount: number,
        unsafeRulesCount: number,
        regexpRulesCount: number,
        ruleSetContentProvider: RuleSetContentProvider,
        badFilterRules: IndexedNetworkRuleWithHash[],
        rulesHashMap: IRulesHashMap,
        unsafeRules?: DeclarativeRule[],
    ) {
        this.id = id;
        this.rulesCount = rulesCount;
        this.unsafeRulesCount = unsafeRulesCount;
        this.regexpRulesCount = regexpRulesCount;
        this.ruleSetContentProvider = ruleSetContentProvider;
        this.badFilterRules = badFilterRules;
        this.rulesHashMap = rulesHashMap;
        this.unsafeRules = unsafeRules;
    }

    /** @inheritdoc */
    public getUnsafeRules(): Promise<DeclarativeRule[]> {
        return Promise.resolve(this.unsafeRules || []);
    }

    /** @inheritdoc */
    public getRulesCount(): number {
        return this.rulesCount || this.declarativeRules.length;
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
     * @throws An error when filter is not found or filter content is unavailable.
     *
     * @returns Promise with list of source rules.
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
     */
    private async loadContent(): Promise<void> {
        if (this.initialized) {
            return;
        }

        if (this.initializerPromise) {
            await this.initializerPromise;
            return;
        }

        const initialize = async (): Promise<void> => {
            const {
                loadSourceMap,
                loadFilterList,
                loadDeclarativeRules,
            } = this.ruleSetContentProvider;

            this.sourceMap = await loadSourceMap();
            this.declarativeRules = await loadDeclarativeRules();
            // TODO: Find a better method to load filters (AG-42364)
            const filtersList = await loadFilterList();
            filtersList.forEach((filter) => {
                this.filterList.set(filter.getId(), filter);
            });

            this.initialized = true;
        };

        this.initializerPromise = initialize().then(() => {
            this.initializerPromise = undefined;
        });
        await this.initializerPromise;
    }

    /** @inheritdoc */
    public unloadContent(): void {
        // If content is not initialized, there is nothing to unload
        if (!this.initialized && !this.initializerPromise) {
            return;
        }

        // If initialization is in progress
        if (this.initializerPromise) {
            this.initializerPromise.finally(() => {
                this.unloadContent();
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
        this.initialized = false;
        this.initializerPromise = undefined;
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
            throw new UnavailableRuleSetSourceError(msg, id, e as Error);
        }
    }

    /** @inheritdoc */
    public getBadFilterRules(): IndexedNetworkRuleWithHash[] {
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
     * @returns List of {@link NetworkRule | network rules}.
     */
    public static getNetworkRuleBySourceRule(
        source: SourceRuleAndFilterId,
    ): NetworkRule[] {
        const { sourceRule, filterId } = source;

        let networkIndexedRulesWithHash: IndexedNetworkRuleWithHash[] = [];

        try {
            networkIndexedRulesWithHash = IndexedNetworkRuleWithHash.createFromNode(
                filterId,
                // We don't need line index because this indexedNetworkRulesWithHash
                // will be used only for matching $badfilter rules.
                0,
                RuleParser.parse(sourceRule),
            );
        } catch (e) {
            return [];
        }

        const networkRules = networkIndexedRulesWithHash.map(({ rule }) => rule.rule);

        return networkRules;
    }

    /**
     * Deserializes rule set to primitives values with lazy load.
     *
     * @param id Id of rule set.
     * @param rawData An item of {@link SerializedRuleSetData} for instant
     * creating ruleset. It contains counters for regular declarative and regexp
     * declarative rules, a map of hashes for all rules, and a list of rules
     * with the `$badfilter` modifier.
     * @param loadLazyData An item of {@link SerializedRuleSetLazyData} for lazy
     * loading ruleset data to find and display source rules when declarative
     * filtering log is enabled. It includes a map of sources for all rules,
     * a list of declarative rules, and a list of source filter IDs.
     * @param loadDeclarativeRules Loader for ruleset's declarative rules from
     * raw file as a string.
     * @param filterList List of {@link IFilter}.
     *
     * @returns Deserialized rule set.
     *
     * @throws Error {@link UnavailableRuleSetSourceError} if rule set source
     * is not available.
     */
    public static async deserialize(
        id: string,
        rawData: string,
        loadLazyData: () => Promise<string>,
        loadDeclarativeRules: () => Promise<string>,
        filterList: IFilter[],
    ): Promise<DeserializedRuleSet> {
        let data: SerializedRuleSetData | undefined;

        try {
            const objectFromString = JSON.parse(rawData);
            data = serializedRuleSetDataValidator.parse(objectFromString);
        } catch (e) {
            // eslint-disable-next-line max-len
            const msg = `Cannot parse serialized ruleset's data with id "${id}", got error: ${getErrorMessage(e)}`;

            throw new UnavailableRuleSetSourceError(msg, id, e as Error);
        }

        /**
         * This variable is used as a singleton for all three functions
         * (`loadSourceMap`, `loadFilterList`, `loadDeclarativeRules`) to load
         * data only once.
         */
        let deserializedLazyData: SerializedRuleSetLazyData | undefined;

        const getLazyData = async (): Promise<SerializedRuleSetLazyData> => {
            if (deserializedLazyData !== undefined) {
                return deserializedLazyData;
            }

            try {
                const lazyData = await loadLazyData();

                const objectFromString = JSON.parse(lazyData);

                deserializedLazyData = serializedRuleSetLazyDataValidator.parse(objectFromString);

                return deserializedLazyData;
            } catch (e) {
                // eslint-disable-next-line max-len
                const msg = `Cannot parse or load data for lazy metadata for rule set with id "${id}": ${getErrorMessage(e)}`;

                throw new UnavailableRuleSetSourceError(msg, id, e as Error);
            }
        };

        const deserialized: DeserializedRuleSet = {
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

                    return filterList.filter((filter) => filterIds.includes(filter.getId()));
                },
                loadDeclarativeRules: async () => {
                    const rawFileContent = await loadDeclarativeRules();

                    const objectFromString = JSON.parse(rawFileContent);

                    const declarativeRules = DeclarativeRuleValidator
                        .array()
                        .parse(objectFromString);

                    return declarativeRules;
                },
            },
        };

        return deserialized;
    }

    /**
     * Helper method to get serialized rule set data.
     *
     * @param unsafeRules Optional list of unsafe rules to add to the serialized
     * output.
     *
     * @returns Serialized rule set data.
     */
    private getSerializedRuleSetData(unsafeRules?: DeclarativeRule[]): SerializedRuleSetData {
        let { rulesCount } = this;

        // If unsaferRules is provided, we should not count them in
        // the rules count, since they are moved to the metadata rule.
        if (unsafeRules) {
            rulesCount -= unsafeRules.length;
        }

        return {
            regexpRulesCount: this.regexpRulesCount,
            unsafeRulesCount: this.unsafeRulesCount,
            rulesCount,
            ruleSetHashMapRaw: this.rulesHashMap.serialize(),
            badFilterRulesRaw: this.badFilterRules.map((r) => RuleGenerator.generate(r.rule.node)),
            unsafeRules,
        };
    }

    /**
     * Helper method to get serialized rule set lazy data.
     *
     * @returns Serialized rule set lazy data.
     */
    private getSerializedRuleSetLazyData(): SerializedRuleSetLazyData {
        return {
            sourceMapRaw: this.sourceMap?.serialize() || EMPTY_STRING,
            filterIds: Array.from(this.filterList.keys()),
        };
    }

    /** @inheritdoc */
    public async serialize(): Promise<SerializedRuleSet> {
        try {
            await this.loadContent();
        } catch (e) {
            const id = this.getId();
            // eslint-disable-next-line max-len
            const msg = `Cannot serialize rule set '${id}' because of not available source, got error: ${getErrorMessage(e)}`;
            throw new UnavailableRuleSetSourceError(msg, id, e as Error);
        }

        const serialized: SerializedRuleSet = {
            id: this.id,
            data: JSON.stringify(this.getSerializedRuleSetData()),
            lazyData: JSON.stringify(this.getSerializedRuleSetLazyData()),
        };

        return serialized;
    }

    /** @inheritdoc */
    public async serializeCompact(
        prettyPrint = true,
        unsafeRules?: DeclarativeRule[],
    ): Promise<string> {
        try {
            await this.loadContent();
        } catch (e) {
            const id = this.getId();
            // eslint-disable-next-line max-len
            const msg = `Cannot serialize ruleset '${id}' because of not available source, got error: ${getErrorMessage(e)}`;
            throw new UnavailableRuleSetSourceError(msg, id, e as Error);
        }

        // TODO: Improve this code once we introduce multiple filters within a single rule set
        // Also, do not forget to change metadata rule's structure to store preprocessed filter lists in an array
        const filter = this.filterList.values().next().value!;
        const content = await filter.getContent();

        // To ensure that unsafe rules are provided and their count is correct,
        // we check if the length of the provided unsafe rules array is equal to
        // the `unsafeRulesCount` property of the rule set.
        if (unsafeRules && unsafeRules.length > 0 && unsafeRules.length !== this.unsafeRulesCount) {
            const id = this.getId();
            // eslint-disable-next-line max-len
            const msg = `Unsafe rules count is not equal to the length of provided unsafe rules array in rule set '${id}'`;
            throw new Error(msg);
        }

        const metadataRule = createMetadataRule({
            metadata: this.getSerializedRuleSetData(unsafeRules),
            lazyMetadata: this.getSerializedRuleSetLazyData(),
            conversionMap: content.conversionMap,
            rawFilterList: content.rawFilterList,
        });

        let declarativeRules = await this.getDeclarativeRules();

        declarativeRules.unshift(metadataRule);

        // Exclude unsafe rules from declarative rules if they are provided.
        if (unsafeRules) {
            const unsafeRulesIds = new Set(unsafeRules.map((rule) => rule.id));

            declarativeRules = declarativeRules.filter((rule) => {
                return !unsafeRulesIds.has(rule.id);
            });
        }

        const result = serializeJson(declarativeRules, prettyPrint);

        return result;
    }
}
