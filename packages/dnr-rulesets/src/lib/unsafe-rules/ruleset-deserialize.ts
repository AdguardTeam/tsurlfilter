import fs from 'node:fs/promises';

import { FilterList } from '@adguard/tsurlfilter';
import {
    Filter,
    IndexedNetworkRuleWithHash,
    IRuleSet,
    RuleSet,
    type RuleSetMetadataProvider,
    RulesHashMap,
} from '@adguard/tsurlfilter/es/declarative-converter';
import { getRuleSetId } from '@adguard/tsurlfilter/es/declarative-converter-utils';

/**
 * Loads ruleset and filter.
 *
 * @param rulesetPath Path to the ruleset.
 * @param id String id (e.g., '999').
 *
 * @returns Promise with loaded Ruleset.
 */
export async function loadRulesetAndFilter(
    rulesetPath: string,
    id: string,
): Promise<IRuleSet> {
    const rulesetRaw = await fs.readFile(rulesetPath, 'utf8');

    // Extract metadata, lazyMetadata, and rules from ruleset JSON
    const parsedRuleset = JSON.parse(rulesetRaw);
    // First rule is always rule with metadata.
    const metadataRule = parsedRuleset[0];
    const {
        metadata,
        lazyMetadata,
        conversionData,
        rawFilterList,
    } = metadataRule.metadata;

    const filterList = new FilterList(rawFilterList, conversionData);

    const filterId = Number(id);
    const filter = new Filter(
        filterId,
        { getContent: (): Promise<FilterList> => Promise.resolve(filterList) },
        true,
    );

    // Prepare Ruleset.deserialize dependencies
    const ruleSetId = getRuleSetId(id);
    const rawData = JSON.stringify(metadata);
    const loadLazyData = async () => JSON.stringify(lazyMetadata);
    const loadDeclarativeRules = async () => JSON.stringify(parsedRuleset.slice(1));
    const filters = [filter];

    // Deserialize Ruleset as in extension
    const {
        data: {
            regexpRulesCount,
            unsafeRulesCount,
            rulesCount,
            ruleSetHashMapRaw,
            badFilterRulesRaw,
        },
        ruleSetContentProvider,
    } = await RuleSet.deserialize(
        ruleSetId,
        rawData,
        loadLazyData,
        loadDeclarativeRules,
        filters,
    );

    const metadataProvider: RuleSetMetadataProvider = {
        loadBadFilterRules: async () => {
            return badFilterRulesRaw
                .map((rawString: string) => IndexedNetworkRuleWithHash.createFromText(0, 0, rawString))
                .flat();
        },
        loadRulesHashMap: async () => {
            const sources = RulesHashMap.deserializeSources(ruleSetHashMapRaw);
            return new RulesHashMap(sources);
        },
    };

    const ruleSet = new RuleSet(
        ruleSetId,
        rulesCount,
        unsafeRulesCount,
        regexpRulesCount,
        ruleSetContentProvider,
        metadataProvider,
    );

    console.log(`Loaded ruleset with ID ${id} from ${rulesetPath}`);

    return ruleSet;
}
