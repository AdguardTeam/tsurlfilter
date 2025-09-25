import { DNR_CONVERTER_VERSION } from '@adguard/dnr-converter';
import { ok } from 'node:assert';

ok(typeof DNR_CONVERTER_VERSION === 'string');

console.log('Smoke test passed in exports/index.ts');
