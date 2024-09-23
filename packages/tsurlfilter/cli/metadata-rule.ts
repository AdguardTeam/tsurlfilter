import { type ResourceType, RuleActionType, type DeclarativeRule } from '../src/rules/declarative-converter';

/**
 * Metadata rule ID. It always should be the first rule in the rule set.
 */
const METADATA_RULE_ID = 1;

/**
 * Metadata key in the rule object.
 */
const METADATA_KEY = 'metadata';

/**
 * Dummy rule URL. It should not match any request.
 */
const DUMMY_RULE_URL = 'dummy.rule.adguard.com';

/**
 * Metadata rule configuration. All of theses fields are serialized to the metadata rule.
 */
interface MetadataRuleConfig<IsSerialized extends boolean = false> {
    /**
     * Contents from declarative/ruleset_N/metadata.json
     */
    metadata: string;

    /**
     * Contents from declarative/ruleset_N/lazy_metadata.json
     */
    lazyMetadata: string;

    /**
     * Contents from filter_N_source_map.json
     */
    sourceMap: IsSerialized extends true ? string : Record<string, number>;

    /**
     * Contents from filter_N_conversion_map.json
     */
    conversionMap: IsSerialized extends true ? string : Record<string, number>;

    /**
     * Contents from filter_N.bin
     */
    filterList: IsSerialized extends true ? string : ArrayBuffer;
}

/**
 * Serialized metadata rule configuration.
 */
type SerializedMetadataRuleConfig = MetadataRuleConfig<true>;

/**
 * Declarative rule extended with metadata.
 */
interface DeclarativeRuleWithMetadata<T> extends DeclarativeRule {
    /**
     * Metadata for the rule.
     */
    [METADATA_KEY]: T;
}

/**
 * Creates a dummy declarative rule with a given ID.
 *
 * This rule is just used as a placeholder for metadata rules and should not block any requests.
 * Static rules can contain additional properties that are just ignored when rules are being loaded.
 */
const createDummyRule = (id = 1): DeclarativeRule => ({
    id,
    action: {
        type: RuleActionType.BLOCK,
    },
    condition: {
        urlFilter: DUMMY_RULE_URL,
        // TODO: Remove type casting when ResourceTypes starts supporting CSP_REPORT
        resourceTypes: ['csp_report' as ResourceType],
    },
});

/**
 * Serializes metadata rule configuration.
 *
 * @param config Metadata rule configuration.
 *
 * @returns Serialized metadata rule configuration.
 */
const serializeMetadata = (config: MetadataRuleConfig): SerializedMetadataRuleConfig => ({
    metadata: config.metadata,
    lazyMetadata: config.lazyMetadata,
    sourceMap: JSON.stringify(config.sourceMap),
    conversionMap: JSON.stringify(config.conversionMap),
    filterList: JSON.stringify(config.filterList),
});

/**
 * Creates a declarative rule with metadata.
 *
 * @param config Metadata rule configuration.
 *
 * @returns Declarative rule with metadata.
 */
export const createMetadataRule = (
    config: MetadataRuleConfig,
): DeclarativeRuleWithMetadata<SerializedMetadataRuleConfig> => {
    const dummyRule = createDummyRule(METADATA_RULE_ID);
    const serializedMetadata = serializeMetadata(config);

    return Object.assign(dummyRule, {
        [METADATA_KEY]: serializedMetadata,
    });
};
