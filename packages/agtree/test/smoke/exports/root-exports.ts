import {
    RuleParser,
    RuleGenerator,
    modifiersCompatibilityTable,
    Platform,
} from '@adguard/agtree';
import { ok } from 'assert';

const ruleText = '||example.com^';
const ruleNode = RuleParser.parse(ruleText);

const generatedRuleText = RuleGenerator.generate(ruleNode);

ok(generatedRuleText === ruleText);

const modifierData = modifiersCompatibilityTable.get('third-party', Platform.AdgExtChrome);

ok(modifierData);

console.log('Smoke test passed in root-exports.ts');
