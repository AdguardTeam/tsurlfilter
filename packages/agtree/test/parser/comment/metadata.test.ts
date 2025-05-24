import { describe, test, expect } from 'vitest';

import { MetadataCommentParser } from '../../../src/parser/comment/metadata-comment-parser.js';
import { EMPTY, SPACE } from '../../../src/utils/constants.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { MetadataCommentGenerator } from '../../../src/generator/comment/metadata-comment-generator.js';
import { MetadataCommentSerializer } from '../../../src/serializer/comment/metadata-comment-serializer.js';
import { MetadataCommentDeserializer } from '../../../src/deserializer/comment/metadata-comment-deserializer.js';

describe('MetadataCommentRuleParser', () => {
    test('parse', () => {
        // TODO: Refactor to test.each
        expect(MetadataCommentParser.parse(EMPTY)).toBeNull();
        expect(MetadataCommentParser.parse(SPACE)).toBeNull();

        // Missing comment marker
        expect(MetadataCommentParser.parse('a:b')).toBeNull();

        // Missing colon
        expect(MetadataCommentParser.parse('!')).toBeNull();
        expect(MetadataCommentParser.parse('!##')).toBeNull();
        expect(MetadataCommentParser.parse('##')).toBeNull();

        // Not a known metadata header
        expect(MetadataCommentParser.parse('!aaa:bbb')).toBeNull();
        expect(MetadataCommentParser.parse('! aaa: bbb')).toBeNull();
        expect(MetadataCommentParser.parse('!aaa:bbb:ccc')).toBeNull();
        expect(MetadataCommentParser.parse('! aaa: bbb: ccc')).toBeNull();

        // Invalid syntax
        expect(MetadataCommentParser.parse('!:::')).toBeNull();
        expect(MetadataCommentParser.parse('! : : :')).toBeNull();

        // Starts like a valid metadata header, but the valid title is followed by
        // an unexpected character
        expect(MetadataCommentParser.parse('! Title a:')).toBeNull();

        // Starts like a valid metadata header, but hasn't a value
        expect(MetadataCommentParser.parse('! Title:')).toBeNull();
        expect(MetadataCommentParser.parse('! Title:  ')).toBeNull();

        expect(MetadataCommentParser.parse('! Title: FilterList Title')).toMatchObject({
            type: 'MetadataCommentRule',
            start: 0,
            end: 25,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            header: {
                type: 'Value',
                start: 2,
                end: 7,
                value: 'Title',
            },
            value: {
                type: 'Value',
                start: 9,
                end: 25,
                value: 'FilterList Title',
            },
        });

        expect(MetadataCommentParser.parse('# Title: FilterList Title')).toMatchObject({
            type: 'MetadataCommentRule',
            start: 0,
            end: 25,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            header: {
                type: 'Value',
                start: 2,
                end: 7,
                value: 'Title',
            },
            value: {
                type: 'Value',
                start: 9,
                end: 25,
                value: 'FilterList Title',
            },
        });

        expect(MetadataCommentParser.parse('! title: FilterList Title')).toMatchObject({
            type: 'MetadataCommentRule',
            start: 0,
            end: 25,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            header: {
                type: 'Value',
                start: 2,
                end: 7,
                value: 'title',
            },
            value: {
                type: 'Value',
                start: 9,
                end: 25,
                value: 'FilterList Title',
            },
        });

        expect(MetadataCommentParser.parse('!    title:    Filter   ')).toMatchObject({
            type: 'MetadataCommentRule',
            start: 0,
            end: 24,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            header: {
                type: 'Value',
                start: 5,
                end: 10,
                value: 'title',
            },
            value: {
                type: 'Value',
                start: 15,
                end: 21,
                value: 'Filter',
            },
        });

        expect(
            MetadataCommentParser.parse('! Homepage: https://github.com/AdguardTeam/some-repo/wiki'),
        ).toMatchObject({
            type: 'MetadataCommentRule',
            start: 0,
            end: 57,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            header: {
                type: 'Value',
                start: 2,
                end: 10,
                value: 'Homepage',
            },
            value: {
                type: 'Value',
                start: 12,
                end: 57,
                value: 'https://github.com/AdguardTeam/some-repo/wiki',
            },
        });
    });

    describe('parser options should work as expected', () => {
        // TODO: Add template for test.each
        test.each([
            {
                actual: '! Title: FilterList Title',
                expected: {
                    type: 'MetadataCommentRule',
                    category: 'Comment',
                    syntax: 'Common',
                    raws: {
                        text: '! Title: FilterList Title',
                    },
                    marker: {
                        type: 'Value',
                        value: '!',
                    },
                    header: {
                        type: 'Value',
                        value: 'Title',
                    },
                    value: {
                        type: 'Value',
                        value: 'FilterList Title',
                    },
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(
                MetadataCommentParser.parse(actual, { ...defaultParserOptions, isLocIncluded: false }),
            ).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = MetadataCommentParser.parse(raw);

            if (ast) {
                return MetadataCommentGenerator.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('! Title: Filter')).toEqual('! Title: Filter');
        expect(parseAndGenerate('!   Title: Filter   ')).toEqual('! Title: Filter');
        expect(parseAndGenerate('# Title: Filter')).toEqual('# Title: Filter');

        expect(parseAndGenerate('! Homepage: https://github.com/AdguardTeam/some-repo/wiki')).toEqual(
            '! Homepage: https://github.com/AdguardTeam/some-repo/wiki',
        );

        expect(parseAndGenerate('# Homepage: https://github.com/AdguardTeam/some-repo/wiki')).toEqual(
            '# Homepage: https://github.com/AdguardTeam/some-repo/wiki',
        );
    });

    describe('serialize & deserialize', () => {
        test.each([
            '! Title: FilterList Title',
            '!   Title: Filter   ',
            '# Title: Filter',
            '! Homepage: https://github.com/AdguardTeam/some-repo/wiki',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                MetadataCommentParser,
                MetadataCommentGenerator,
                MetadataCommentSerializer,
                MetadataCommentDeserializer,
            );
        });
    });
});
