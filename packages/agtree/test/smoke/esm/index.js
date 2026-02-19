import { RuleParser, modifiersCompatibilityTable, Platform } from '@adguard/agtree';
import { ok } from 'assert';

const ruleNode = RuleParser.parse('||example.com^');

ok(ruleNode);

const modifierData = modifiersCompatibilityTable.get('third-party', Platform.AdgExtChrome);

ok(modifierData);

console.log('Smoke test passed');
