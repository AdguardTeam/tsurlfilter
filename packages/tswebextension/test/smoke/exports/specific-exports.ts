import { getFilterName } from '@adguard/tswebextension/mv3/utils';
import assert from 'node:assert';

// TODO: Add tests for more imports

const filterName = getFilterName(1);
assert.ok(filterName === 'filter_1.txt');

console.log('Smoke test for @adguard/tswebextension passed in specific-exports.ts');
