import { RuleParser } from '@adguard/agtree/parser';
import { ok } from 'assert';

const ruleNode = RuleParser.parse('||example.com^');

console.log(ruleNode);
ok(ruleNode);
