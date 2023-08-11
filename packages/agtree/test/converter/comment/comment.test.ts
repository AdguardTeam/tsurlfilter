import { CommentRuleConverter } from '../../../src/converter/comment';
import { CommentRuleParser } from '../../../src/parser/comment';
import { type CommentRule } from '../../../src/parser/common';

describe('CommentRuleConverter', () => {
    describe('convertToAdg', () => {
        test.each([
            // Leave non-affected comments as is
            {
                actual: '! This is a comment',
                expected: [
                    '! This is a comment',
                ],
            },
            {
                actual: '! Title: Foo',
                expected: [
                    '! Title: Foo',
                ],
            },
            {
                actual: '[Adblock Plus 2.0]',
                expected: [
                    '[Adblock Plus 2.0]',
                ],
            },
            {
                actual: '!#endif',
                expected: [
                    '!#endif',
                ],
            },
            {
                actual: '!+ NOT_OPTIMIZED',
                expected: [
                    '!+ NOT_OPTIMIZED',
                ],
            },

            // Should convert comments to AdGuard syntax

            // Note: no need to test ###selector here, because AGTree parses it as
            // a cosmetic rule, not a comment
            {
                actual: '#####',
                expected: [
                    '! #####',
                ],
            },
            {
                actual: '# ubo syntax comment',
                expected: [
                    '! # ubo syntax comment',
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', ({ actual, expected }) => {
            const commentRuleNode = CommentRuleParser.parse(actual);

            if (!commentRuleNode) {
                throw new Error(`Failed to parse comment rule: ${actual}`);
            }

            const convertedRuleNodes = CommentRuleConverter.convertToAdg(commentRuleNode);

            expect(convertedRuleNodes).toHaveLength(expected.length);
            expect(
                convertedRuleNodes.map(CommentRuleParser.generate),
            ).toEqual(expected);
        });
    });

    describe('convertToUbo', () => {
        // TODO: We should implement this later
        expect(() => CommentRuleConverter.convertToUbo(
            CommentRuleParser.parse('! this is a comment') as CommentRule,
        )).toThrowError(
            'Not implemented',
        );
    });

    describe('convertToAbp', () => {
        // TODO: We should implement this later
        expect(() => CommentRuleConverter.convertToAbp(
            CommentRuleParser.parse('! this is a comment') as CommentRule,
        )).toThrowError(
            'Not implemented',
        );
    });
});
