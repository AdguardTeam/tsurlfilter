import * as AGTreeV2 from 'agtree-v2';
import { test } from 'vitest';

import { RuleParser } from '../src/parser/rule-parser';

const RULES = [
    '||example.org^$third-party',
    'example.com##.banner',
    'example.com#%#//scriptlet(\'set-constant\', \'a\', \'true\')',
    '@@||example.net^$document',
];

test('AGTree parse: current vs v2', async ({ bench }) => {
    await bench.compare(
        bench('current parse', () => {
            for (const rule of RULES) {
                RuleParser.parse(rule);
            }
        }),
        bench('v2 parse', () => {
            for (const rule of RULES) {
                AGTreeV2.RuleParser.parse(rule);
            }
        }),
    );
});
