import { describe, expect, it } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import { CommentRuleConverter } from '../../../src/converter/comment';
import { type CommentRule } from '../../../src/nodes';

const parser = new RuleParserPipeline();

describe('CommentRuleConverter', () => {
    describe('convertToAdg', () => {
        it.each([
            // Leave non-affected comments as is
            {
                actual: '! This is a comment',
                expected: [
                    '! This is a comment',
                ],
                shouldConvert: false,
            },
            {
                actual: '! Title: Foo',
                expected: [
                    '! Title: Foo',
                ],
                shouldConvert: false,
            },
            {
                actual: '[Adblock Plus 2.0]',
                expected: [
                    '[Adblock Plus 2.0]',
                ],
                shouldConvert: false,
            },
            {
                actual: '!#endif',
                expected: [
                    '!#endif',
                ],
                shouldConvert: false,
            },
            {
                actual: '!+ NOT_OPTIMIZED',
                expected: [
                    '!+ NOT_OPTIMIZED',
                ],
                shouldConvert: false,
            },

            // Should convert comments to AdGuard syntax

            // Note: no need to test ###selector here, because AGTree parses it as
            // a cosmetic rule, not a comment
            {
                actual: '#####',
                expected: [
                    '! #####',
                ],
                shouldConvert: true,
            },
            {
                actual: '# ubo syntax comment',
                expected: [
                    '! # ubo syntax comment',
                ],
                shouldConvert: true,
            },
            // Marker-to-text spacing must be preserved from AST metadata, not
            // inferred from content: `#comment` and `# comment` both expose the
            // text `comment` after the parser trims the marker whitespace.
            {
                actual: '#comment',
                expected: [
                    '! #comment',
                ],
                shouldConvert: true,
            },
            {
                actual: '# comment',
                expected: [
                    '! # comment',
                ],
                shouldConvert: true,
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperlyNew(CommentRuleConverter, 'convertToAdg');
        });
    });

    it('convertToUbo', () => {
        // TODO: We should implement this later
        expect(() => CommentRuleConverter.convertToUbo(
            parser.parse('! this is a comment') as CommentRule,
        )).toThrowError(
            'Not implemented',
        );
    });

    it('convertToAbp', () => {
        // TODO: We should implement this later
        expect(() => CommentRuleConverter.convertToAbp(
            parser.parse('! this is a comment') as CommentRule,
        )).toThrowError(
            'Not implemented',
        );
    });
});
