import { type AnyRule, RuleParserPipeline } from '@adguard/agtree';
import { CosmeticRuleGenerator, RuleGenerator } from '@adguard/agtree/generator';
import { ok } from 'assert';

const ruleText = '||example.com^';
const pipeline = new RuleParserPipeline();
const result = pipeline.parse(ruleText);

const generatedRuleText = RuleGenerator.generate(result as AnyRule);
ok(generatedRuleText === ruleText);

ok(CosmeticRuleGenerator);

console.log('Smoke test passed in specific-exports.ts');
