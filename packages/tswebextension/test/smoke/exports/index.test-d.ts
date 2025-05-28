import { expectNotType } from 'tsd';

import { TsWebExtension } from '@adguard/tswebextension';

expectNotType<any>(TsWebExtension);

console.log('Smoke test passed in index.test-d.ts');
