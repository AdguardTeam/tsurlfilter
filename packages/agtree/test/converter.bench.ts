import * as AGTreeV2 from 'agtree-v2';
import { test } from 'vitest';

import { RuleConverter } from '../src/converter/rule';
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

test('AGTree convert: current vs v2', async ({ bench }) => {
    const currentNodes = RULES.map((rule) => RuleParser.parse(rule));
    const v2Nodes = RULES.map((rule) => AGTreeV2.RuleParser.parse(rule));

    await bench.compare(
        bench('current convert', () => {
            for (const node of currentNodes) {
                resultSink += RuleConverter.convertToAdg(node).result ? 1 : 0;
            }
        }),
        bench('v2 convert', () => {
            for (const node of v2Nodes) {
                resultSink += AGTreeV2.RuleConverter.convertToAdg(node).result ? 1 : 0;
            }
        }),
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
});
