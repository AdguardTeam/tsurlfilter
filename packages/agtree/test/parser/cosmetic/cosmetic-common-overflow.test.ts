import { describe, expect, test } from 'vitest';

import { createParserContext, initParserContext } from '../../../src/parser/context';
import { RuleParser } from '../../../src/parser/rule';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

describe('cosmetic-common modifier list overflow', () => {
    test('throws on modifier list overflow (FR-005)', () => {
        const tokenizer = new Tokenizer(1024);
        // maxMods=1 means only 1 modifier fits; [$a,b] has 2 comma-separated modifiers.
        // grow=false preserves the legacy throw-on-overflow behaviour.
        const ctx = createParserContext(1024, 1, undefined, undefined, false);
        const source = '[$a,b]example.com##.ad';
        tokenizer.setSource(source);
        initParserContext(ctx, source, tokenizer);
        expect(() => RuleParser.parse(ctx, 0, ctx.tokenCount, 0)).toThrow(/Too many modifiers/);
    });
});
