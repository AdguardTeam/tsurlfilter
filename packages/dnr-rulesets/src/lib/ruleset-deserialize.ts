import { RuleParser } from '@adguard/agtree';
import { FilterListPreprocessor, PreprocessedFilterList } from '@adguard/tsurlfilter';
import {
    Filter,
    type IFilter,
    IndexedNetworkRuleWithHash,
    RuleSet,
    RulesHashMap,
} from '@adguard/tsurlfilter/es/declarative-converter';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Loads RuleSet and Filter from directory by id, similar to extension.
 *
 * @param dir Directory with ruleset and filter.
 * @param id String id (e.g., '999').
 *
 * @returns Promise with loaded RuleSet and Filter.
 */
export async function loadRuleSetAndFilterFromDir(
    dir: string,
    id: string,
): Promise<{ ruleSet: RuleSet; filter: IFilter }> {
    const rulesetPath = path.join(dir, `declarative/ruleset_${id}/ruleset_${id}.json`);

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
    const ruleSetId = id;
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
            // disableUnsafeRulesIds,
            // addUnsafeRules,
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
        // disableUnsafeRulesIds,
        // addUnsafeRules,
    );

    return { ruleSet, filter };
}
