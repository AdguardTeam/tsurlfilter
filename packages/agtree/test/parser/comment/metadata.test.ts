import { MetadataCommentRuleParser } from '../../../src/parser/comment/metadata';
import { EMPTY, SPACE } from '../../../src/utils/constants';

describe('MetadataCommentRuleParser', () => {
    test('parse', () => {
        // TODO: Refactor to test.each
        expect(MetadataCommentRuleParser.parse(EMPTY)).toBeNull();
        expect(MetadataCommentRuleParser.parse(SPACE)).toBeNull();

        // Missing comment marker
        expect(MetadataCommentRuleParser.parse('a:b')).toBeNull();

        // Missing colon
        expect(MetadataCommentRuleParser.parse('!')).toBeNull();
        expect(MetadataCommentRuleParser.parse('!##')).toBeNull();
        expect(MetadataCommentRuleParser.parse('##')).toBeNull();

        // Not a known metadata header
        expect(MetadataCommentRuleParser.parse('!aaa:bbb')).toBeNull();
        expect(MetadataCommentRuleParser.parse('! aaa: bbb')).toBeNull();
        expect(MetadataCommentRuleParser.parse('!aaa:bbb:ccc')).toBeNull();
        expect(MetadataCommentRuleParser.parse('! aaa: bbb: ccc')).toBeNull();

        // Invalid syntax
        expect(MetadataCommentRuleParser.parse('!:::')).toBeNull();
        expect(MetadataCommentRuleParser.parse('! : : :')).toBeNull();

        // Starts like a valid metadata header, but the valid title is followed by
        // an unexpected character
        expect(MetadataCommentRuleParser.parse('! Title a:')).toBeNull();

        // Starts like a valid metadata header, but hasn't a value
        expect(MetadataCommentRuleParser.parse('! Title:')).toBeNull();
        expect(MetadataCommentRuleParser.parse('! Title:  ')).toBeNull();

        expect(MetadataCommentRuleParser.parse('! Title: FilterList Title')).toMatchObject({
            type: 'MetadataCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 25,
                    line: 1,
                    column: 26,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            header: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 7,
                        line: 1,
                        column: 8,
                    },
                },
                value: 'Title',
            },
            value: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 9,
                        line: 1,
                        column: 10,
                    },
                    end: {
                        offset: 25,
                        line: 1,
                        column: 26,
                    },
                },
                value: 'FilterList Title',
            },
        });

        expect(MetadataCommentRuleParser.parse('# Title: FilterList Title')).toMatchObject({
            type: 'MetadataCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 25,
                    line: 1,
                    column: 26,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '#',
            },
            header: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 7,
                        line: 1,
                        column: 8,
                    },
                },
                value: 'Title',
            },
            value: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 9,
                        line: 1,
                        column: 10,
                    },
                    end: {
                        offset: 25,
                        line: 1,
                        column: 26,
                    },
                },
                value: 'FilterList Title',
            },
        });

        expect(MetadataCommentRuleParser.parse('! title: FilterList Title')).toMatchObject({
            type: 'MetadataCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 25,
                    line: 1,
                    column: 26,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            header: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 7,
                        line: 1,
                        column: 8,
                    },
                },
                value: 'title',
            },
            value: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 9,
                        line: 1,
                        column: 10,
                    },
                    end: {
                        offset: 25,
                        line: 1,
                        column: 26,
                    },
                },
                value: 'FilterList Title',
            },
        });

        expect(MetadataCommentRuleParser.parse('!    title:    Filter   ')).toMatchObject({
            type: 'MetadataCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 24,
                    line: 1,
                    column: 25,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            header: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 5,
                        line: 1,
                        column: 6,
                    },
                    end: {
                        offset: 10,
                        line: 1,
                        column: 11,
                    },
                },
                value: 'title',
            },
            value: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 15,
                        line: 1,
                        column: 16,
                    },
                    end: {
                        offset: 21,
                        line: 1,
                        column: 22,
                    },
                },
                value: 'Filter',
            },
        });

        expect(
            MetadataCommentRuleParser.parse('! Homepage: https://github.com/AdguardTeam/some-repo/wiki'),
        ).toMatchObject({
            type: 'MetadataCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 57,
                    line: 1,
                    column: 58,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            header: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 10,
                        line: 1,
                        column: 11,
                    },
                },
                value: 'Homepage',
            },
            value: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 12,
                        line: 1,
                        column: 13,
                    },
                    end: {
                        offset: 57,
                        line: 1,
                        column: 58,
                    },
                },
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
            expect(MetadataCommentRuleParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = MetadataCommentRuleParser.parse(raw);

            if (ast) {
                return MetadataCommentRuleParser.generate(ast);
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
});
