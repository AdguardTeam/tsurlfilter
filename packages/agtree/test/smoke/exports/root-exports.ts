import {
    type AnyRule,
    RuleParserPipeline,
    RuleGenerator,
    modifiersCompatibilityTable,
    Platform,
} from '@adguard/agtree';
import { ok } from 'assert';

const ruleText = '||example.com^';
const pipeline = new RuleParserPipeline();
const result = pipeline.parse(ruleText);

if (result) {
    const generatedRuleText = RuleGenerator.generate(result as AnyRule);
    ok(generatedRuleText === ruleText);
} else {
    ok(false, 'Failed to parse rule');
}

const modifierData = modifiersCompatibilityTable.get('third-party', Platform.AdgExtChrome);

ok(modifierData);

console.log('Smoke test passed in root-exports.ts');
