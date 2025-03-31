import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    vi,
} from 'vitest';
import {
    type AnyRule,
    InputByteBuffer,
    OutputByteBuffer,
    RuleDeserializer,
} from '@adguard/agtree';
import { RuleParser, defaultParserOptions } from '@adguard/agtree/parser';
import { RuleSerializer } from '@adguard/agtree/serializer';
import { readFile } from 'node:fs/promises';
import { omit } from 'lodash-es';

import {
    FilterListPreprocessor,
    type LightweightPreprocessedFilterList,
    type PreprocessedFilterList,
} from '../../../src/filterlist/preprocessor';

// TODO: Add more tests

/**
 * Helper function to create a serialized filter list from a list of rules.
 *
 * @param rules List of rules to serialize.
 *
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
        beforeAll(() => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterAll(() => {
            vi.restoreAllMocks();
        });

        it.each<{ name: string; actual: string; expected: PreprocessedFilterList }>([
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
                name: 'should handle invalid rules',
                actual: '||example.com^\nexample.com##+js(,\n||example.org^',
                expected: {
                    filterList: makeSerializedFilterList([
                        '||example.com^',
                        '||example.org^',
                    ]),
                    rawFilterList: '||example.com^\nexample.com##+js(,\n||example.org^',
                    conversionMap: {},
                    sourceMap: {
                        4: 0,
                        29: 34,
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

    describe('preprocessLightweight', () => {
        beforeAll(() => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterAll(() => {
            vi.restoreAllMocks();
        });

        it.each<{ name: string; actual: LightweightPreprocessedFilterList; expected: PreprocessedFilterList }>([
            {
                name: 'empty filter list',
                actual: {
                    rawFilterList: '',
                    conversionMap: {},
                },
                expected: {
                    filterList: makeSerializedFilterList([]),
                    rawFilterList: '',
                    conversionMap: {},
                    sourceMap: {},
                },
            },
            {
                name: 'one rule',
                actual: {
                    rawFilterList: '||example.com^',
                    conversionMap: {},
                },
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
                actual: {
                    rawFilterList: '||example.com^\n',
                    conversionMap: {},
                },
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
                actual: {
                    rawFilterList: '||example.com^\n||example.org^',
                    conversionMap: {},
                },
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
                actual: {
                    rawFilterList: '||example.com^\r\n||example.org^',
                    conversionMap: {},
                },
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
                name: 'should handle invalid rules',
                actual: {
                    rawFilterList: '||example.com^\nexample.com##+js(,\n||example.org^',
                    conversionMap: {},
                },
                expected: {
                    filterList: makeSerializedFilterList([
                        '||example.com^',
                        '||example.org^',
                    ]),
                    rawFilterList: '||example.com^\nexample.com##+js(,\n||example.org^',
                    conversionMap: {},
                    sourceMap: {
                        4: 0,
                        29: 34,
                    },
                },
            },
            {
                name: 'should ignore comments and empty rules from binary rules',
                actual: {
                    rawFilterList: '||example.com^\n! this is a comment\n  \n||example.org^',
                    conversionMap: {},
                },
                expected: {
                    filterList: makeSerializedFilterList([
                        '||example.com^',
                        '||example.org^',
                    ]),
                    rawFilterList: '||example.com^\n! this is a comment\n  \n||example.org^',
                    conversionMap: {},
                    sourceMap: {
                        4: 0,
                        29: 38,
                    },
                },
            },
            {
                name: 'converting non-AdGuard rules',
                actual: {
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
                },
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
            const preprocessedFilterList = FilterListPreprocessor.preprocessLightweight(actual);
            expect(preprocessedFilterList).toEqual(expected);
        });
    });

    describe('getOriginalRules', () => {
        it.each<{ name: string; actual: string; expected: string[] }>([
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

    describe('createEmptyPreprocessedFilterList', () => {
        it('creates an empty preprocessed filter list', () => {
            const preprocessedFilterList = FilterListPreprocessor.createEmptyPreprocessedFilterList();

            expect(preprocessedFilterList).toEqual({
                filterList: makeSerializedFilterList([]),
                rawFilterList: '',
                conversionMap: {},
                sourceMap: {},
            });
        });

        it('empty preprocessed filter list is equal to the one created by preprocess for an empty filter list', () => {
            const emptyPreprocessedFilterList = FilterListPreprocessor.createEmptyPreprocessedFilterList();
            const preprocessedFilterList = FilterListPreprocessor.preprocess('');

            expect(emptyPreprocessedFilterList.filterList).toEqual(preprocessedFilterList.filterList);
            expect(emptyPreprocessedFilterList.rawFilterList).toEqual(preprocessedFilterList.rawFilterList);
            expect(emptyPreprocessedFilterList.conversionMap).toEqual(preprocessedFilterList.conversionMap);
            expect(emptyPreprocessedFilterList.sourceMap).toEqual(preprocessedFilterList.sourceMap);
        });
    });

    describe('verify preprocess and preprocessLightweight are consistent', () => {
        it.each([
            '../../resources/adguard_base_filter.txt',
            // TODO: Add more test cases
        ])('for %s', async (filename) => {
            const rawFilterContent = await readFile(new URL(`./${filename}`, import.meta.url), 'utf-8');

            const preprocessResult = FilterListPreprocessor.preprocess(rawFilterContent);

            const preprocessLightweightResult = FilterListPreprocessor.preprocessLightweight({
                rawFilterList: preprocessResult.rawFilterList,
                conversionMap: preprocessResult.conversionMap,
            });

            const buffer = new InputByteBuffer(preprocessResult.filterList);
            const bufferLightweight = new InputByteBuffer(preprocessLightweightResult.filterList);

            let node1: AnyRule;
            let node2: AnyRule;

            // TODO: Use scanner from AGTree once it's available (AG-39995)
            RuleDeserializer.deserialize(buffer, node1 = {} as AnyRule);
            RuleDeserializer.deserialize(bufferLightweight, node2 = {} as AnyRule);

            while (buffer.peekUint8() !== 0 && bufferLightweight.peekUint8() !== 0) {
                // TODO: Improve converter to handle syntax more precisely (AG-40033)
                // Currently, if a rule is converted to AdGuard rule, it's syntax property is set to 'AdGuard',
                // but if we stringify that rule node, then re-parse it, the syntax property will be set to 'Common'.
                // As a workaround, we omit the syntax property when comparing the nodes.
                expect(omit(node1, ['syntax'])).toEqual(omit(node2, ['syntax']));

                RuleDeserializer.deserialize(buffer, node1 = {} as AnyRule);
                RuleDeserializer.deserialize(bufferLightweight, node2 = {} as AnyRule);
            }

            expect(preprocessResult.sourceMap).toEqual(preprocessLightweightResult.sourceMap);
        });
    });
});
