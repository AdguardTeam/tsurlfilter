import { RuleParser } from '@adguard/agtree';
import { FilterListPreprocessor, PreprocessedFilterList } from '@adguard/tsurlfilter';
import {
    Filter,
    type IFilter,
    IndexedNetworkRuleWithHash,
    RuleSet,
    RulesHashMap,
} from '@adguard/tsurlfilter/es/declarative-converter';
import { getRuleSetId } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import { promises as fs } from 'fs';

/**
 * Loads ruleset and filter from directory by id.
 *
 * @param rulesetPath Path to the ruleset.
 * @param id String id (e.g., '999').
 *
 * @returns Promise with loaded RuleSet and Filter.
 */
export async function loadRuleSetAndFilterFromDir(
    rulesetPath: string,
    id: string,
): Promise<{ ruleSet: RuleSet; filter: IFilter }> {
    const rulesetRaw = await fs.readFile(rulesetPath, 'utf8');

    // --- Extract metadata, lazyMetadata, and rules from ruleset JSON ---
    const parsedRuleSet = JSON.parse(rulesetRaw);
    const {
        metadata,
        lazyMetadata,
        conversionMap,
        rawFilterList,
    } = parsedRuleSet[0].metadata;

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

    // --- Prepare RuleSet.deserialize dependencies ---
    const ruleSetId = getRuleSetId(id);
    const rawData = JSON.stringify(metadata);
    const loadLazyData = async () => JSON.stringify(lazyMetadata);
    const loadDeclarativeRules = async () => JSON.stringify(parsedRuleSet.slice(1));
    const filterList = [filter];

    // --- Deserialize RuleSet as in extension ---
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
        unsafeRulesCount || 0,
        regexpRulesCount,
        ruleSetContentProvider,
        badFilterRules,
        ruleSetHashMap,
    );

    return { ruleSet, filter };
}
