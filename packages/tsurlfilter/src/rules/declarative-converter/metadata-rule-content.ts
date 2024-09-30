import { type SerializedRuleSetData, type SerializedRuleSetLazyData } from './rule-set';

/**
 * Metadata rule configuration. All of theses fields are serialized to the metadata rule.
 */
export interface MetadataRuleContent {
    /**
     * Contents from declarative/ruleset_N/metadata.json.
     */
    metadata: SerializedRuleSetData;

    /**
     * Contents from declarative/ruleset_N/lazy_metadata.json.
     */
    lazyMetadata: SerializedRuleSetLazyData;

    /**
     * Contents from filter_N_source_map.json.
     */
    sourceMap: Record<string, number>;

    /**
     * Contents from filter_N_conversion_map.json.
     */
    conversionMap: Record<string, string>;

    /**
     * Contents from filter_N.bin.
     */
    filterList: string[];
}
