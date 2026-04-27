import { expectNotType } from 'tsd';

import { Engine } from '@adguard/tsurlfilter';

expectNotType<any>(Engine);
expectNotType<any>(Engine.prototype.getRemoveParamUrl);

console.log('Smoke test passed in index.test-d.ts');
