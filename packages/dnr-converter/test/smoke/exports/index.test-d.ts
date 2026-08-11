import {
    DNR_CONVERTER_VERSION,
    Filter,
    FilterConverter,
    MetadataRuleset,
    METADATA_RULESET_ID,
    Ruleset,
    RulesetWithSourceMap,
    getRulesetId,
    getRulesetPath,
    extractRulesetId,
    type ConversionResult,
    type DeserializedRuleset,
    type IFilter,
    type IRuleset,
    type IRulesetWithSourceMap,
    type IRulesHashMap,
    type ISourceMap,
    type RulesetContentProvider,
    type SerializedRuleset,
    type SerializedRulesetData,
    type SerializedRulesetLazyData,
    type SourceRuleAndFilterId,
    type UpdateStaticRulesOptions,
} from '@adguard/dnr-converter';
import { convertFilters, generateMD5Hash, type ConvertFiltersOptions } from '@adguard/dnr-converter/cli';
import { expectType } from 'tsd';

expectType<string>(DNR_CONVERTER_VERSION);
expectType<typeof Filter>(Filter);
expectType<typeof FilterConverter>(FilterConverter);
expectType<typeof Ruleset>(Ruleset);
expectType<typeof RulesetWithSourceMap>(RulesetWithSourceMap);
expectType<typeof MetadataRuleset>(MetadataRuleset);
expectType<0>(METADATA_RULESET_ID);

expectType<typeof getRulesetId>(getRulesetId);
expectType<typeof getRulesetPath>(getRulesetPath);
expectType<typeof extractRulesetId>(extractRulesetId);

// Verify type exports are accessible (no runtime assertions needed for types)
type AssertIRuleset = IRuleset;
type AssertIRulesetWithSourceMap = IRulesetWithSourceMap;
type AssertIFilter = IFilter;
type AssertConversionResult = ConversionResult;
type AssertIRulesHashMap = IRulesHashMap;
type AssertISourceMap = ISourceMap;
type AssertRulesetContentProvider = RulesetContentProvider;
type AssertSourceRuleAndFilterId = SourceRuleAndFilterId;
type AssertUpdateStaticRulesOptions = UpdateStaticRulesOptions;
type AssertSerializedRuleset = SerializedRuleset;
type AssertDeserializedRuleset = DeserializedRuleset;
type AssertSerializedRulesetData = SerializedRulesetData;
type AssertSerializedRulesetLazyData = SerializedRulesetLazyData;

expectType<(
    filtersAndMetadataDir: string,
    resourcesDir: string,
    destRulesetsDir: string,
    options?: ConvertFiltersOptions,
) => Promise<void>>(convertFilters);

expectType<(input: string) => string>(generateMD5Hash);

console.log('Smoke test passed in exports/index.test-d.ts');
