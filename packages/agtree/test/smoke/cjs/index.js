const { RuleParser, modifiersCompatibilityTable, SpecificPlatform } = require('@adguard/agtree');
const { ok } = require('assert');

const ruleNode = RuleParser.parse('||example.com^');

ok(ruleNode);

const modifierData = modifiersCompatibilityTable.getSingle('third-party', SpecificPlatform.AdgExtChrome);

ok(modifierData);

console.log('Smoke test passed');
