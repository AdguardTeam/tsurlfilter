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

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('AGTree parse: current vs v2', async ({ bench }) => {
    await bench.compare(
        bench('current parse', () => {
            for (const rule of RULES) {
                resultSink += RuleParser.parse(rule) ? 1 : 0;
            }
        }),
        bench('v2 parse', () => {
            for (const rule of RULES) {
                resultSink += AGTreeV2.RuleParser.parse(rule) ? 1 : 0;
            }
        }),
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
});
