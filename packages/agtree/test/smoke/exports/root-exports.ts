import {
    type AnyRule,
    FilterListGenerator,
    FilterListPipeline,
    ListItemNodeType,
    ListNodeType,
    NodeType,
    RuleGenerator,
    RuleKind,
    RuleParserPipeline,
    ValueKind,
    modifiersCompatibilityTable,
    parseAppList,
    parseDomainList,
    parseMethodList,
    parseModifier,
    parseStealthOptionList,
    Platform,
} from '@adguard/agtree';
import { ok } from 'assert';

const ruleText = '||example.com^';
const pipeline = new RuleParserPipeline();
const result: AnyRule = pipeline.parse(ruleText);

const generatedRuleText = RuleGenerator.generate(result);
ok(generatedRuleText === ruleText);

const modifierData = modifiersCompatibilityTable.get('third-party', Platform.AdgExtChrome);

ok(modifierData);

// Root value exports — node discriminant enums are importable as values.
ok(NodeType);
ok(ValueKind);
ok(ListNodeType);
ok(ListItemNodeType);
ok(NodeType.RawRule === 'RawRule');
ok(NodeType.Raw === 'Raw');

// RuleKind must be a runtime value (not a const-enum-only type) so consumers
// with isolatedModules can use `RuleKind.Network` in value positions.
ok(typeof RuleKind === 'object');
ok(RuleKind.Network === 0);
ok(RuleKind.Comment === 1);
ok(RuleKind.Cosmetic === 2);

// List-parsing helper family is symmetric at the root.
ok(typeof parseDomainList === 'function');
ok(typeof parseModifier === 'function');
ok(typeof parseAppList === 'function');
ok(typeof parseMethodList === 'function');
ok(typeof parseStealthOptionList === 'function');

const mod = parseModifier('third-party');
ok(mod.type === NodeType.Modifier);

// Generation symmetry — FilterListGenerator mirrors FilterListPipeline.
ok(FilterListGenerator);
ok(FilterListPipeline);

console.log('Smoke test passed in root-exports.ts');
