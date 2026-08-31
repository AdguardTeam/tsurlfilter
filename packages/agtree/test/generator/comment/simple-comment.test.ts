import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import { RuleGenerator } from '../../../src/generator/rule-generator';

const parser = new RuleParserPipeline();

describe('SimpleCommentGenerator — marker-to-text spacing', () => {
    test.each([
        // Default single-space spacing is preserved.
        '! This is just a comment',
        '# This is just a comment',
        // No space between marker and text must round-trip losslessly
        // (previously the generator forced a single space).
        '!comment',
        '#comment',
        // Marker-only comments must not gain a trailing space.
        '!',
        '#',
        // Multiple hashes (host-style comment) must round-trip.
        '#####',
        // Non-default (multiple) spacing is preserved verbatim.
        '#   spaced comment',
    ])('should round-trip %j', (raw) => {
        const ast = parser.parse(raw);
        expect(RuleGenerator.generate(ast)).toBe(raw);
    });
});
