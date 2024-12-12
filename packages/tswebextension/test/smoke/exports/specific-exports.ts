import assert from 'node:assert';

import { getFilterName } from '@adguard/tswebextension/mv3/utils';

// TODO: Add tests for more imports

const filterName = getFilterName(1);
assert.ok(filterName === 'filter_1.txt');

// eslint-disable-next-line no-console
console.log('Smoke test for @adguard/tswebextension passed in specific-exports.ts');
