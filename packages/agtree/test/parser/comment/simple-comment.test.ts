import { describe, test, expect } from 'vitest';

import { SimpleCommentParser } from '../../../src/parser/comment/simple-comment-parser';
import { EMPTY, SPACE } from '../../../src/utils/constants';
import { defaultParserOptions } from '../../../src/parser/options';
import { isNull } from '../../../src/utils/type-guards';
import { SimpleCommentGenerator } from '../../../src/generator/comment/simple-comment-generator';
import { SimpleCommentSerializer } from '../../../src/serializer/comment/simple-comment-serializer';
import { SimpleCommentDeserializer } from '../../../src/deserializer/comment/simple-comment-deserializer';

describe('SimpleCommentParser', () => {
    describe('isSimpleComment', () => {
        test.each([
            // Empty
            [EMPTY, false],
            [SPACE, false],

            // Begins with !
            ['!', true],
            ['!!', true],
            ['!comment', true],
            ['! comment', true],
            ['!+comment', true],
            ['!#comment', true],
            ['!#########################', true],
            ['! #########################', true],
            [' !', true],
            ['  !', true],

            // Begins with #
            ['#', true],
            ['##', true],
            ['# #', true],
            ['#comment', true],
            ['# comment', true],
            ['#+comment', true],
            ['#########################', true],
            ['# ########################', true],
            [' #', true],
            ['  ##', true],

            // Cosmetic rules (also begins with #)
            ['##.selector', false],
            ['#@#.selector', false],
            ["#%#//scriptlet('scriptlet')", false],
            [" #%#//scriptlet('scriptlet')", false],

            // Single-letter HTML tag selectors
            // https://github.com/AdguardTeam/tsurlfilter/issues/172
            //   - just tags
            ['##p', false],
            ['##a', false],
            ['##h1', false],
            ['##div', false],
            //   - tags with CSS combinators
            ['##p > a', false],
            ['##p a', false],
            ['##p + a', false],
            ['##p ~ a', false],
            ['##a > span', false],
            ['##p > a[href^="/test"]', false],
            ['##p > a[href^="/AllRes/Vlog"]', false],

            // Multi-letter tags with combinators
            ['##div > span', false],
            ['##div > a', false],
            ['##article > p', false],
        ])('isCommentRule(%p) should return %p', (input, expected) => {
            expect(SimpleCommentParser.isSimpleComment(input)).toBe(expected);
        });
    });

    test('parse', () => {
        // TODO: Refactor to test.each
        // Empty / not comment
        expect(SimpleCommentParser.parse(EMPTY)).toBeNull();
        expect(SimpleCommentParser.parse(SPACE)).toBeNull();
        expect(SimpleCommentParser.parse('##.ad')).toBeNull();
        expect(SimpleCommentParser.parse('#@#.ad')).toBeNull();

        // Single-letter HTML tag selectors should not be parsed as comments
        expect(SimpleCommentParser.parse('##p')).toBeNull();
        expect(SimpleCommentParser.parse('##a')).toBeNull();
        expect(SimpleCommentParser.parse('##p > a')).toBeNull();
        expect(SimpleCommentParser.parse('##p > a[href^="/AllRes/Vlog"]')).toBeNull();

        expect(SimpleCommentParser.parse('! This is just a comment')).toMatchObject({
            category: 'Comment',
            type: 'CommentRule',
            start: 0,
            end: 24,
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            text: {
                type: 'Value',
                start: 1,
                end: 24,
                value: ' This is just a comment',
            },
        });

        expect(SimpleCommentParser.parse('# This is just a comment')).toMatchObject({
            category: 'Comment',
            type: 'CommentRule',
            start: 0,
            end: 24,
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            text: {
                type: 'Value',
                start: 1,
                end: 24,
                value: ' This is just a comment',
            },
        });

        expect(SimpleCommentParser.parse('!#########################')).toMatchObject({
            category: 'Comment',
            type: 'CommentRule',
            start: 0,
            end: 26,
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            text: {
                type: 'Value',
                start: 1,
                end: 26,
                value: '#########################',
            },
        });

        expect(SimpleCommentParser.parse('##########################')).toMatchObject({
            category: 'Comment',
            type: 'CommentRule',
            start: 0,
            end: 26,
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            text: {
                type: 'Value',
                start: 1,
                end: 26,
                value: '#########################',
            },
        });
    });

    describe('parser options should work as expected', () => {
        // TODO: Add template for test.each
        test.each([
            {
                actual: '! This is just a comment',
                expected: {
                    category: 'Comment',
                    type: 'CommentRule',
                    syntax: 'Common',
                    raws: {
                        text: '! This is just a comment',
                    },
                    marker: {
                        type: 'Value',
                        value: '!',
                    },
                    text: {
                        type: 'Value',
                        value: ' This is just a comment',
                    },
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(
                SimpleCommentParser.parse(actual, { ...defaultParserOptions, isLocIncluded: false }),
            ).toEqual(expected);
        });
    });

    describe('generate', () => {
        test.each([
            ['! This is just a comment', '! This is just a comment'],
            ['# This is just a comment', '# This is just a comment'],
            ['!#########################', '!#########################'],
            ['##########################', '##########################'],
            ['! #########################', '! #########################'],
            ['# #########################', '# #########################'],
        ])('generate(%p, %p) should return %p', (input, expected) => {
            const node = SimpleCommentParser.parse(input);

            if (isNull(node)) {
                throw new Error('Rule cannot be parsed as comment');
            }

            expect(SimpleCommentGenerator.generate(node)).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            '! This is just a comment',
            '# This is just a comment',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                SimpleCommentParser,
                SimpleCommentGenerator,
                SimpleCommentSerializer,
                SimpleCommentDeserializer,
            );
        });
    });
});
