import { DNR_CONVERTER_VERSION } from '@adguard/dnr-converter';
import { expectType } from 'tsd';

expectType<string>(DNR_CONVERTER_VERSION);

console.log('Smoke test passed in exports/index.test-d.ts');
