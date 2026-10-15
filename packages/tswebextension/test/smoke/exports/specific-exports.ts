import assert from 'node:assert';

import { getRuleFilename } from '@adguard/tswebextension/mv3/preregistered-scripts/build-contract';
import { getPreregisteredRootUrl } from '@adguard/tswebextension/mv3/preregistered-scripts/root-request';
import { getFilterName } from '@adguard/tswebextension/mv3/utils';

// TODO: Add tests for more imports

const filterName = getFilterName(1);
assert.ok(filterName === 'filter_1.txt');

assert.ok(getRuleFilename('deadbeefdeadbeef') === 'deadbeefdeadbeef.js');

assert.ok(getPreregisteredRootUrl('youtube.com') === 'https://youtube.com/');

// eslint-disable-next-line no-console
console.log('Smoke test for @adguard/tswebextension passed in specific-exports.ts');
