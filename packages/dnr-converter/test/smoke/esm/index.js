import {
    DNR_CONVERTER_VERSION,
    Filter,
    FilterConverter,
    MetadataRuleset,
    Ruleset,
    RulesetWithSourceMap,
} from '@adguard/dnr-converter';
import { ok } from 'node:assert';

ok(typeof DNR_CONVERTER_VERSION === 'string');
ok(typeof Filter === 'function');
ok(typeof FilterConverter === 'function');
ok(typeof Ruleset === 'function');
ok(typeof RulesetWithSourceMap === 'function');
ok(typeof MetadataRuleset === 'function');

console.log('Smoke test passed in esm/index.js');
