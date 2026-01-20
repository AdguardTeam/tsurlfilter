import { RuleParser } from '@adguard/agtree/parser';
import { CosmeticRuleGenerator, RuleGenerator } from '@adguard/agtree/generator';
import { ok } from 'assert';

const ruleText = '||example.com^';
const ruleNode = RuleParser.parse(ruleText);

const generatedRuleText = RuleGenerator.generate(ruleNode);

ok(generatedRuleText === ruleText);

ok(CosmeticRuleGenerator);

console.log('Smoke test passed in specific-exports.ts');
