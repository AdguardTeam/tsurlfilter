import { expectNotType } from 'tsd';

import { AssetsLoader } from '@adguard/dnr-rulesets';

expectNotType<any>(AssetsLoader);

console.log('Smoke test passed in index.test-d.ts');
