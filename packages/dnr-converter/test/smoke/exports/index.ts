import { DNR_CONVERTER_VERSION, Filter } from '@adguard/dnr-converter';
import { convertFilters, generateMD5Hash } from '@adguard/dnr-converter/cli';
import { ok } from 'node:assert';

ok(typeof DNR_CONVERTER_VERSION === 'string');
ok(typeof Filter === 'function');
ok(typeof convertFilters === 'function');
ok(typeof generateMD5Hash === 'function');

console.log('Smoke test passed in exports/index.ts');
