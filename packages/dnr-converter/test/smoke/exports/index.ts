import { DNR_CONVERTER_VERSION, Filter } from '@adguard/dnr-converter';
import { ok } from 'node:assert';

ok(typeof DNR_CONVERTER_VERSION === 'string');
ok(typeof Filter === 'function');

console.log('Smoke test passed in exports/index.ts');
