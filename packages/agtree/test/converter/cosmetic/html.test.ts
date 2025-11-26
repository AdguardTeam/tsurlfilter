import { describe, test, expect } from 'vitest';

import { ERROR_MESSAGES, HtmlRuleConverter } from '../../../src/converter/cosmetic/html';
import { type HtmlFilteringRule } from '../../../src/nodes';
import { RuleParser } from '../../../src/parser/rule-parser';
import { NotImplementedError } from '../../../src/errors/not-implemented-error';
import { createNodeConversionResult } from '../../../src/converter/base-interfaces/conversion-result';

/**
 * Invalid test data interface.
 */
interface InvalidTestData {
    /**
     * Input rule.
     */
    input: string | HtmlFilteringRule;

    /**
     * Expected error message.
     */
    error: string;
}

describe('HtmlRuleConverter', () => {
    describe('convertToAdg', () => {
        describe('from ADG', () => {
            test('should not convert and return the same rule', () => {
                const rule = {
                    syntax: 'AdGuard',
                } as HtmlFilteringRule;

                expect(HtmlRuleConverter.convertToAdg(rule)).toEqual(createNodeConversionResult([rule], false));
            });
        });

        describe('from ABP', () => {
            test('should throw unsupported error', () => {
                expect(() => HtmlRuleConverter.convertToAdg({
                    syntax: 'AdblockPlus',
                } as HtmlFilteringRule)).toThrowError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
            });
        });

        describe('from uBO - valid cases', () => {
            test.each([
                {
                    actual: '##^tag',
                    expected: ['$$tag[max-length="262144"]'],
                },
                {
                    actual: '##^tag[attr1="value1"][attr2=value2][attr3]',
                    expected: ['$$tag[attr1="value1"][attr2="value2"][attr3][max-length="262144"]'],
                },
                {
                    actual: '##^tag[min-length="1"]',
                    expected: ['$$tag[min-length="1"][max-length="262144"]'],
                },
                {
                    actual: '##^tag[max-length="10"]',
                    expected: ['$$tag[max-length="10"]'],
                },
                {
                    actual: '##^tag[tag-content="test"]',
                    expected: ['$$tag[tag-content="test"][max-length="262144"]'],
                },
                {
                    actual: '##^tag[tag-content="test1\\"test2"]',
                    expected: ['$$tag[tag-content="test1""test2"][max-length="262144"]'],
                },
                {
                    actual: '##^tag[wildcard="value"]',
                    expected: ['$$tag[wildcard="value"][max-length="262144"]'],
                },
                {
                    // eslint-disable-next-line max-len
                    actual: '##^tag[min-length="5"][max-length="15"][tag-content="example"][attr="val"][wildcard="value"]',
                    // eslint-disable-next-line max-len
                    expected: ['$$tag[attr="val"][wildcard="value"][tag-content="example"][min-length="5"][max-length="15"]'],
                },
                {
                    actual: '##^tag:min-text-length(1)',
                    expected: ['$$tag[min-length="1"][max-length="262144"]'],
                },
                {
                    actual: '##^tag:has-text(test)',
                    expected: ['$$tag[tag-content="test"][max-length="262144"]'],
                },
                {
                    actual: '##^tag:has-text(test1\\"test2)',
                    expected: ['$$tag[tag-content="test1""test2"][max-length="262144"]'],
                },
                {
                    actual: '##^tag:contains(test)',
                    expected: ['$$tag[tag-content="test"][max-length="262144"]'],
                },
                {
                    actual: '##^tag:contains(test1\\"test2)',
                    expected: ['$$tag[tag-content="test1""test2"][max-length="262144"]'],
                },
                {
                    actual: '##^tag[min-length="1"]:min-text-length(2)',
                    expected: ['$$tag[min-length="2"][max-length="262144"]'],
                },
                {
                    actual: '##^tag[tag-content="test1"]:has-text(test2)',
                    expected: ['$$tag[tag-content="test2"][max-length="262144"]'],
                },
                {
                    actual: '##^tag[tag-content="test1"]:contains(test2)',
                    expected: ['$$tag[tag-content="test2"][max-length="262144"]'],
                },
                {
                    actual: '##^tag1[attr1="value1"], tag2[attr2="value2"], tag3[attr3="value3"]',
                    expected: [
                        '$$tag1[attr1="value1"][max-length="262144"]',
                        '$$tag2[attr2="value2"][max-length="262144"]',
                        '$$tag3[attr3="value3"][max-length="262144"]',
                    ],
                },
            ])('should convert \'$input\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(HtmlRuleConverter, 'convertToAdg');
            });
        });

        describe('from uBO - invalid cases', () => {
            test.each<InvalidTestData>([
                {
                    input: {
                        body: {
                            selectors: [],
                        },
                    } as unknown as HtmlFilteringRule,
                    error: 'Invalid HTML filtering rule: Rule must contain at least one selector',
                },
                {
                    input: '##^tag[attr="value" i]',
                    error: 'Attribute selector value with flags is not supported',
                },
                {
                    input: '##^tag[min-length]',
                    error: 'Attribute selector \'min-length\' requires a value',
                },
                {
                    input: '##^tag[max-length]',
                    error: 'Attribute selector \'max-length\' requires a value',
                },
                {
                    input: '##^tag[wildcard]',
                    error: 'Attribute selector \'wildcard\' requires a value',
                },
                {
                    input: '##^tag[tag-content]',
                    error: 'Attribute selector \'tag-content\' requires a value',
                },
                {
                    input: '##^tag[min-length="test"]',
                    error: 'The value of attribute selector \'min-length\' must be an integer, got \'test\'',
                },
                {
                    input: '##^tag[max-length="test"]',
                    error: 'The value of attribute selector \'max-length\' must be an integer, got \'test\'',
                },
                {
                    input: '##^tag[min-length="-1"]',
                    error: 'The value of attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                },
                {
                    input: '##^tag[max-length="-1"]',
                    error: 'The value of attribute selector \'max-length\' must be a positive integer, got \'-1\'',
                },
                {
                    input: '##^tag:some-pseudo()',
                    error: 'Pseudo class \'some-pseudo\' is not supported',
                },
                {
                    input: '##^tag:has-text(/some-regexp/)',
                    error: 'Regular expressions are not supported in the pseudo class content \'has-text\'',
                },
                {
                    input: '##^tag:contains(/some-regexp/)',
                    error: 'Regular expressions are not supported in the pseudo class content \'contains\'',
                },
                {
                    input: '##^tag:min-text-length()',
                    error: 'Pseudo class \'min-text-length\' requires a content value',
                },
                {
                    input: '##^tag:min-text-length(   )',
                    error: 'Pseudo class \'min-text-length\' requires a content value',
                },
            ])('should not convert \'$input\'', ({ input, error }) => {
                if (typeof input !== 'string') {
                    expect(() => {
                        HtmlRuleConverter.convertToAdg(input);
                    }).toThrowError(error);
                } else {
                    expect(() => {
                        HtmlRuleConverter.convertToAdg(RuleParser.parse(input) as HtmlFilteringRule);
                    }).toThrowError(error);
                }
            });
        });
    });

    describe('convertToUbo', () => {
        describe('from uBO', () => {
            test('should not convert and return the same rule', () => {
                const rule = {
                    syntax: 'UblockOrigin',
                } as HtmlFilteringRule;

                expect(HtmlRuleConverter.convertToUbo(rule)).toEqual(createNodeConversionResult([rule], false));
            });
        });

        describe('from ABP', () => {
            test('should throw unsupported error', () => {
                expect(() => HtmlRuleConverter.convertToUbo({
                    syntax: 'AdblockPlus',
                } as HtmlFilteringRule)).toThrowError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
            });
        });

        describe('from ADG - valid cases', () => {
            test.each([
                {
                    actual: '$$tag',
                    expected: ['##^tag'],
                },
                {
                    actual: '$$tag[attr1="value1"][attr2=value2][attr3]',
                    expected: ['##^tag[attr1="value1"][attr2="value2"][attr3]'],
                },
                {
                    actual: '$$tag[min-length="5"]',
                    expected: ['##^tag:min-text-length(5)'],
                },
                {
                    actual: '$$tag[max-length="262144"]',
                    expected: ['##^tag'],
                },
                {
                    actual: '$$tag[tag-content="test"]',
                    expected: ['##^tag:has-text(test)'],
                },
                {
                    actual: '$$tag[tag-content="test1""test2"]',
                    expected: ['##^tag:has-text(test1\\"test2)'],
                },
                {
                    actual: '$$tag[min-length="10"][tag-content="test"]',
                    expected: ['##^tag:min-text-length(10):has-text(test)'],
                },
                {
                    actual: '$$tag[min-length="10"][tag-content="test1""test2"]',
                    expected: ['##^tag:min-text-length(10):has-text(test1\\"test2)'],
                },
            ])('should convert \'$input\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(HtmlRuleConverter, 'convertToUbo');
            });
        });

        describe('from ADG - invalid cases', () => {
            test.each<InvalidTestData>([
                {
                    input: {
                        body: {
                            selectors: [],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: AdGuard HTML filtering rules support only one selector per rule, got 0 selectors',
                },
                {
                    input: {
                        body: {
                            selectors: [{}, {}],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: AdGuard HTML filtering rules support only one selector per rule, got 2 selectors',
                },
                {
                    input: {
                        body: {
                            selectors: [{
                                pseudoClasses: [{}],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    error: 'Invalid HTML filtering rule: AdGuard HTML filtering rules do not support pseudo classes',
                },
                {
                    input: {
                        body: {
                            selectors: [{
                                attributes: [{
                                    flags: {},
                                }],
                                pseudoClasses: [],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    error: 'Invalid HTML filtering rule: Attribute selector value with flags is not supported',
                },
                {
                    input: '$$tag[min-length]',
                    error: 'Attribute selector \'min-length\' requires a value',
                },
                {
                    input: '$$tag[max-length]',
                    error: 'Attribute selector \'max-length\' requires a value',
                },
                {
                    input: '$$tag[wildcard]',
                    error: 'Attribute selector \'wildcard\' requires a value',
                },
                {
                    input: '$$tag[tag-content]',
                    error: 'Attribute selector \'tag-content\' requires a value',
                },
                {
                    input: '$$tag[min-length="test"]',
                    error: 'The value of attribute selector \'min-length\' must be an integer, got \'test\'',
                },
                {
                    input: '$$tag[max-length="test"]',
                    error: 'The value of attribute selector \'max-length\' must be an integer, got \'test\'',
                },
                {
                    input: '$$tag[min-length="-1"]',
                    error: 'The value of attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                },
                {
                    input: '$$tag[max-length="-1"]',
                    error: 'The value of attribute selector \'max-length\' must be a positive integer, got \'-1\'',
                },
            ])('should not convert \'$input\'', ({ input, error }) => {
                if (typeof input !== 'string') {
                    expect(() => {
                        HtmlRuleConverter.convertToUbo(input);
                    }).toThrowError(error);
                } else {
                    expect(() => {
                        HtmlRuleConverter.convertToUbo(RuleParser.parse(input) as HtmlFilteringRule);
                    }).toThrowError(error);
                }
            });
        });
    });

    describe('convertToAbp', () => {
        describe('from ABP', () => {
            test('should throw not implemented error', () => {
                expect(() => HtmlRuleConverter.convertToAbp({
                    syntax: 'AdblockPlus',
                } as HtmlFilteringRule)).toThrowError(NotImplementedError);
            });
        });

        describe('from ADG', () => {
            test('should throw not implemented error', () => {
                expect(() => HtmlRuleConverter.convertToAbp({
                    syntax: 'AdGuard',
                } as HtmlFilteringRule)).toThrowError(NotImplementedError);
            });
        });

        describe('from uBO', () => {
            test('should throw not implemented error', () => {
                expect(() => HtmlRuleConverter.convertToAbp({
                    syntax: 'UblockOrigin',
                } as HtmlFilteringRule)).toThrowError(NotImplementedError);
            });
        });
    });
});
