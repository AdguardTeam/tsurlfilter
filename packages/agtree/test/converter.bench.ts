import * as AGTreeV2 from 'agtree-v2';
import { test } from 'vitest';

import { RuleConverter } from '../src/converter/rule';
import { RuleParser } from '../src/parser/rule-parser';

const RULES = [
    '||example.org^$third-party',
    'example.com##.banner',
    'example.com#%#//scriptlet(\'set-constant\', \'a\', \'true\')',
    '@@||example.net^$document',
];

test('AGTree convert: current vs v2', async ({ bench }) => {
    const currentNodes = RULES.map((rule) => RuleParser.parse(rule));
    const v2Nodes = RULES.map((rule) => AGTreeV2.RuleParser.parse(rule));

    await bench.compare(
        bench('current convert', () => {
            for (const node of currentNodes) {
                RuleConverter.convertToAdg(node);
            }
        }),
        bench('v2 convert', () => {
            for (const node of v2Nodes) {
                AGTreeV2.RuleConverter.convertToAdg(node);
            }
        }),
    );
});
