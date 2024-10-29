import { RuleParser } from '@adguard/agtree/parser';
import { CosmeticRuleGenerator } from '@adguard/agtree/generator';
import { ok } from 'assert';

const ruleNode = RuleParser.parse('||example.com^');

console.log(ruleNode);
ok(ruleNode);

ok(CosmeticRuleGenerator);
