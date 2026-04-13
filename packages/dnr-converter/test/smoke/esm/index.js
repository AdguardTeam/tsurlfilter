import {
    DNR_CONVERTER_VERSION,
    FilterConverter,
    FilterConverterWithSourceMap,
    Ruleset,
    RulesetWithSourceMap,
} from '@adguard/dnr-converter';
import { ok } from 'node:assert';

ok(typeof DNR_CONVERTER_VERSION === 'string');
ok(typeof FilterConverter === 'function');
ok(typeof FilterConverterWithSourceMap === 'function');
ok(typeof Ruleset === 'function');
ok(typeof RulesetWithSourceMap === 'function');

console.log('Smoke test passed in esm/index.js');
