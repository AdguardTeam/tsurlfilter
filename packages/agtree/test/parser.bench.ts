import * as AGTreeV2 from 'agtree-v2';
import { test } from 'vitest';

import { RuleParser } from '../src/parser/rule-parser';

const RULES = [
    '! Title: Example',
    '||example.org^$third-party',
    '@@||example.net^$document',
    'example.com##.banner',
    'example.com#?#div:has(> .ad)',
    'example.com#%#//scriptlet(\'set-constant\', \'a\', \'true\')',
    'example.com#$#.ad { display: none; }',
    '||example.org^$removeparam=utm_source',
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
