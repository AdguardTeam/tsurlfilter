import assert from 'node:assert';

import { getRuleFilename } from '@adguard/tswebextension/mv3/preregistered-scripts/build-contract';
import { getFilterName } from '@adguard/tswebextension/mv3/utils';

// TODO: Add tests for more imports

const filterName = getFilterName(1);
assert.ok(filterName === 'filter_1.txt');

assert.ok(getRuleFilename('deadbeefdeadbeef') === 'deadbeefdeadbeef.js');

// eslint-disable-next-line no-console
console.log('Smoke test for @adguard/tswebextension passed in specific-exports.ts');
