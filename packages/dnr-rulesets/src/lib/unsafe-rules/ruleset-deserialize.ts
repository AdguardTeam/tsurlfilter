import { promises as fs } from 'node:fs';

import { RuleParser } from '@adguard/agtree/parser';
import { FilterListPreprocessor, PreprocessedFilterList } from '@adguard/tsurlfilter';
import {
    Filter,
    IndexedNetworkRuleWithHash,
    IRuleSet,
    RuleSet,
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
        conversionMap,
        rawFilterList,
    } = metadataRule.metadata;

    const preprocessedFilterList = FilterListPreprocessor.preprocessLightweight({
        rawFilterList,
        conversionMap,
    });

    const filterId = Number(id);
    const filter = new Filter(
        filterId,
        { getContent: (): Promise<PreprocessedFilterList> => Promise.resolve(preprocessedFilterList) },
        true,
    );

    // Prepare Ruleset.deserialize dependencies
    const ruleSetId = getRuleSetId(id);
    const rawData = JSON.stringify(metadata);
    const loadLazyData = async () => JSON.stringify(lazyMetadata);
    const loadDeclarativeRules = async () => JSON.stringify(parsedRuleset.slice(1));
    const filterList = [filter];

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
        filterList,
    );

    const sources = RulesHashMap.deserializeSources(ruleSetHashMapRaw);
    const ruleSetHashMap = new RulesHashMap(sources);
    const badFilterRules = badFilterRulesRaw
        .map((rawString: string) => IndexedNetworkRuleWithHash.createFromNode(0, 0, RuleParser.parse(rawString)))
        .flat();

    const ruleSet = new RuleSet(
        ruleSetId,
        rulesCount,
        unsafeRulesCount,
        regexpRulesCount,
        ruleSetContentProvider,
        badFilterRules,
        ruleSetHashMap,
    );

    console.log(`Loaded ruleset with ID ${id} from ${rulesetPath}`);

    return ruleSet;
}
