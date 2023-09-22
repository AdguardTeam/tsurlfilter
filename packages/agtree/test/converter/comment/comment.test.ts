import { CommentRuleConverter } from '../../../src/converter/comment';
import { CommentRuleParser } from '../../../src/parser/comment';
import { type CommentRule } from '../../../src/parser/common';
import '../../matchers/check-conversion';

describe('CommentRuleConverter', () => {
    describe('convertToAdg', () => {
        test.each([
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
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(CommentRuleConverter, 'convertToAdg');
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
