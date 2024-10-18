import {
    RuleParser,
    RuleSerializer,
    RuleGenerator,
    RuleDeserializer,
    modifiersCompatibilityTable,
    SpecificPlatform
} from '@adguard/agtree';
import { ok } from 'assert';

const ruleNode = RuleParser.parse('||example.com^');

ok(ruleNode);
ok(RuleSerializer);
ok(RuleGenerator);
ok(RuleDeserializer);

const modifierData = modifiersCompatibilityTable.getSingle('third-party', SpecificPlatform.AdgExtChrome);

ok(modifierData);

console.log('Smoke test passed');
