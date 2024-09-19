import { RuleParser } from '@adguard/agtree';
import { ok } from 'assert';

const ruleNode = RuleParser.parse('||example.com^');

ok(ruleNode);

console.log('Smoke test passed');
