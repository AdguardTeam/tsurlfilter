import {
    DNR_CONVERTER_VERSION,
    FilterConverter,
    FilterConverterWithSourceMap,
    Ruleset,
    RulesetWithSourceMap,
    type IRuleset,
    type IRulesetWithSourceMap,
    MetadataRuleset,
    METADATA_RULESET_ID,
    type IFilter,
    type IFilterWithSource,
    type ConversionResult,
    type IRulesHashMap,
    type ISourceMap,
    type RulesetContentProvider,
    type SourceRuleAndFilterId,
    type UpdateStaticRulesOptions,
    type SerializedRuleset,
    type DeserializedRuleset,
    type SerializedRulesetData,
    type SerializedRulesetLazyData,
} from '@adguard/dnr-converter';
import { expectType } from 'tsd';

expectType<string>(DNR_CONVERTER_VERSION);
expectType<typeof FilterConverter>(FilterConverter);
expectType<typeof FilterConverterWithSourceMap>(FilterConverterWithSourceMap);
expectType<typeof Ruleset>(Ruleset);
expectType<typeof RulesetWithSourceMap>(RulesetWithSourceMap);
expectType<typeof MetadataRuleset>(MetadataRuleset);
expectType<0>(METADATA_RULESET_ID);

// Verify type exports are accessible (no runtime assertions needed for types)
type AssertIRuleset = IRuleset;
type AssertIRulesetWithSourceMap = IRulesetWithSourceMap;
type AssertIFilter = IFilter;
type AssertIFilterWithSource = IFilterWithSource;
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

console.log('Smoke test passed in exports/index.test-d.ts');
