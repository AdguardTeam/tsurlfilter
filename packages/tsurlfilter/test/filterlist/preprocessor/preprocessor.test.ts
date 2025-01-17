import { OutputByteBuffer } from '@adguard/agtree';
import { RuleParser, defaultParserOptions } from '@adguard/agtree/parser';
import { RuleSerializer } from '@adguard/agtree/serializer';
import { FilterListPreprocessor, type PreprocessedFilterList } from '../../../src/filterlist/preprocessor';

// TODO: Add more tests

/**
 * Helper function to create a serialized filter list from a list of rules.
 *
 * @param rules List of rules to serialize.
 * @returns Serialized chunks of the filter list.
 */
const makeSerializedFilterList = (rules: string[]): Uint8Array[] => {
    const buffer = new OutputByteBuffer();
    for (const rule of rules) {
        const node = RuleParser.parse(rule, {
            ...defaultParserOptions,
            includeRaws: false,
            isLocIncluded: false,
            ignoreComments: false,
            parseHostRules: false,
        });

        RuleSerializer.serialize(node, buffer);
    }

    return buffer.getChunks();
};

describe('FilterListPreprocessor', () => {
    describe('preprocess', () => {
        it.each<{ name: string, actual: string, expected: PreprocessedFilterList }>([
            {
                name: 'empty filter list',
                actual: '',
                expected: {
                    filterList: makeSerializedFilterList([]),
                    rawFilterList: '',
                    conversionMap: {},
                    sourceMap: {},
                },
            },
            {
                name: 'one rule',
                actual: '||example.com^',
                expected: {
                    filterList: makeSerializedFilterList([
                        '||example.com^',
                    ]),
                    rawFilterList: '||example.com^',
                    conversionMap: {},
                    sourceMap: {
                        4: 0,
                    },
                },
            },
            {
                name: 'one rule + trailing line',
                actual: '||example.com^\n',
                expected: {
                    filterList: makeSerializedFilterList([
                        '||example.com^',
                    ]),
                    rawFilterList: '||example.com^\n',
                    conversionMap: {},
                    sourceMap: {
                        4: 0,
                    },
                },
            },
            {
                name: 'two rules',
                actual: '||example.com^\n||example.org^',
                expected: {
                    filterList: makeSerializedFilterList([
                        '||example.com^',
                        '||example.org^',
                    ]),
                    rawFilterList: '||example.com^\n||example.org^',
                    conversionMap: {},
                    sourceMap: {
                        4: 0,
                        29: 15,
                    },
                },
            },
            {
                name: 'two rules, but CRLF',
                actual: '||example.com^\r\n||example.org^',
                expected: {
                    filterList: makeSerializedFilterList([
                        '||example.com^',
                        '||example.org^',
                    ]),
                    rawFilterList: '||example.com^\r\n||example.org^',
                    conversionMap: {},
                    sourceMap: {
                        4: 0,
                        29: 16,
                    },
                },
            },
            {
                name: 'converting non-AdGuard rules',
                actual: [
                    'example.com##+js(foo)',
                    'example.com#$#bar;baz',
                ].join('\n'),
                expected: {
                    filterList: makeSerializedFilterList([
                        "example.com#%#//scriptlet('ubo-foo')",
                        "example.com#%#//scriptlet('abp-bar')",
                        "example.com#%#//scriptlet('abp-baz')",
                    ]),
                    rawFilterList: [
                        "example.com#%#//scriptlet('ubo-foo')",
                        "example.com#%#//scriptlet('abp-bar')",
                        "example.com#%#//scriptlet('abp-baz')",
                    ].join('\n'),
                    conversionMap: {
                        0: 'example.com##+js(foo)',
                        37: 'example.com#$#bar;baz',
                        74: 'example.com#$#bar;baz',
                    },
                    sourceMap: {
                        4: 0,
                        63: 37,
                        122: 74,
                    },
                },
            },
        ])('handles $name', ({ actual, expected }) => {
            const preprocessedFilterList = FilterListPreprocessor.preprocess(actual);
            expect(preprocessedFilterList).toEqual(expected);
        });
    });

    describe('getOriginalRules', () => {
        it.each<{ name: string, actual: string, expected: string[] }>([
            {
                name: 'empty filter list',
                actual: '',
                expected: [],
            },
            {
                name: 'one rule',
                actual: '||example.com^',
                expected: ['||example.com^'],
            },
            {
                name: 'one rule and line break',
                actual: '||example.com^\n',
                expected: ['||example.com^', ''],
            },
            {
                name: 'two rules',
                actual: '||example.com^\n||example.org^',
                expected: ['||example.com^', '||example.org^'],
            },
            {
                name: 'two rules and line break',
                actual: '||example.com^\n||example.org^\n',
                expected: ['||example.com^', '||example.org^', ''],
            },
            {
                name: 'two rules and an empty line with spaces',
                actual: '||example.com^\n||example.org^\n  \n',
                expected: ['||example.com^', '||example.org^', '  ', ''],
            },
            {
                name: 'converted rule',
                actual: 'example.com##+js(foo)',
                expected: ['example.com##+js(foo)'],
            },
            {
                name: 'converted rule and line break',
                actual: 'example.com##+js(foo)\n',
                expected: ['example.com##+js(foo)', ''],
            },
            {
                name: 'rule that was converted to multiple rules',
                actual: 'example.com#$#foo;bar;baz',
                expected: ['example.com#$#foo;bar;baz'],
            },
            {
                name: 'converted rule and rule that was converted to multiple rules',
                actual: [
                    'example.com##+js(foo)',
                    'example.com#$#bar;baz',
                ].join('\n'),
                expected: [
                    'example.com##+js(foo)',
                    'example.com#$#bar;baz',
                ],
            },
        ])('handles $name', ({ actual, expected }) => {
            const preprocessedFilterList = FilterListPreprocessor.preprocess(actual);
            const originalRules = FilterListPreprocessor.getOriginalRules(preprocessedFilterList);
            expect(originalRules).toEqual(expected);
        });
    });
});
