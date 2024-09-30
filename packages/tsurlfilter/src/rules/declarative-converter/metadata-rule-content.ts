import { z } from 'zod';

import { serializedRuleSetDataValidator, serializedRuleSetLazyDataValidator } from './rule-set-interfaces';

/**
 * Metadata rule configuration. All of theses fields are serialized to the metadata rule.
 */
export const metadataRuleContentValidator = z.object({
    /**
     * Contents from declarative/ruleset_N/metadata.json.
     */
    metadata: serializedRuleSetDataValidator,

    /**
     * Contents from declarative/ruleset_N/lazy_metadata.json.
     */
    lazyMetadata: serializedRuleSetLazyDataValidator,

    /**
     * Contents from filter_N.txt.
     */
    rawFilterList: z.string(),

    /**
     * Contents from filter_N_source_map.json.
     */
    sourceMap: z.record(z.number()),

    /**
     * Contents from filter_N_conversion_map.json.
     */
    conversionMap: z.record(z.string()),

    /**
     * Contents from filter_N.bin.
     */
    filterList: z.array(z.string()),
});

export type MetadataRuleContent = z.infer<typeof metadataRuleContentValidator>;
