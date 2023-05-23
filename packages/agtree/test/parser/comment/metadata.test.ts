import { MetadataCommentRuleParser } from '../../../src/parser/comment/metadata';
import { EMPTY, SPACE } from '../../../src/utils/constants';

describe('MetadataCommentRuleParser', () => {
    test('parse', () => {
        expect(MetadataCommentRuleParser.parse(EMPTY)).toBeNull();
        expect(MetadataCommentRuleParser.parse(SPACE)).toBeNull();

        expect(MetadataCommentRuleParser.parse('!')).toBeNull();
        expect(MetadataCommentRuleParser.parse('!##')).toBeNull();
        expect(MetadataCommentRuleParser.parse('##')).toBeNull();
        expect(MetadataCommentRuleParser.parse('!aaa:bbb')).toBeNull();
        expect(MetadataCommentRuleParser.parse('! aaa: bbb')).toBeNull();
        expect(MetadataCommentRuleParser.parse('!aaa:bbb:ccc')).toBeNull();
        expect(MetadataCommentRuleParser.parse('! aaa: bbb: ccc')).toBeNull();
        expect(MetadataCommentRuleParser.parse('!:::')).toBeNull();
        expect(MetadataCommentRuleParser.parse('! : : :')).toBeNull();

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

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = MetadataCommentRuleParser.parse(raw);

            if (ast) {
                return MetadataCommentRuleParser.generate(ast);
            }

            return null;
        };

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
