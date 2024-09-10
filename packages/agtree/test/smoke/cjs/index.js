const { RuleParser } = require('@adguard/agtree');
const { ok } = require('assert');

const ruleNode = RuleParser.parse('||example.com^');

ok(ruleNode);

console.log('Smoke test passed');
