import { expectNotType } from 'tsd';

import { Engine } from '@adguard/tsurlfilter';

expectNotType<any>(Engine);

console.log('Smoke test passed in index.test-d.ts');
