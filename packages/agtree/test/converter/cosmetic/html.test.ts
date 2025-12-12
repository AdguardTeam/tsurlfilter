import { describe, test, expect } from 'vitest';

import { ERROR_MESSAGES, HtmlRuleConverter } from '../../../src/converter/cosmetic/html';
import { type HtmlFilteringRule } from '../../../src/nodes';
import { RuleParser } from '../../../src/parser/rule-parser';
import { NotImplementedError } from '../../../src/errors/not-implemented-error';
import { createNodeConversionResult } from '../../../src/converter/base-interfaces/conversion-result';
import { defaultParserOptions, type ParserOptions } from '../../../src/parser/options';

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

/**
 * Default parser options with HTML filtering rules parsing enabled.
 */
const parsingEnabledDefaultParserOptions: ParserOptions = {
    ...defaultParserOptions,
    parseHtmlFilteringRuleBodies: true,
};

describe('HtmlRuleConverter', () => {
    describe('convertToAdg', () => {
        describe('from ABP', () => {
            test('should throw unsupported error', () => {
                expect(() => HtmlRuleConverter.convertToAdg({
                    syntax: 'AdblockPlus',
                } as HtmlFilteringRule)).toThrowError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
            });
        });

        describe('from ADG', () => {
            describe('parsed - valid cases', () => {
                test.each([
                    // complex selector without special simplex selectors
                    {
                        actual: '$$div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                        expected: ['$$div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)'],
                    },

                    // `[min-length]` special attribute selector
                    {
                        actual: '$$div[min-length="10"]',
                        expected: ['$$div:contains(/^(?=.{10,}$).*/s)'],
                    },

                    // `[min-length]` special attribute selector - multiple usages
                    {
                        actual: '$$div[min-length="10"][min-length="20"]',
                        expected: ['$$div:contains(/^(?=.{10,}$).*/s):contains(/^(?=.{20,}$).*/s)'],
                    },

                    // `[max-length]` special attribute selector
                    {
                        actual: '$$div[max-length="100"]',
                        expected: ['$$div:contains(/^(?=.{0,100}$).*/s)'],
                    },

                    // `[max-length]` special attribute selector - multiple usages
                    {
                        actual: '$$div[max-length="100"][max-length="200"]',
                        expected: ['$$div:contains(/^(?=.{0,100}$).*/s):contains(/^(?=.{0,200}$).*/s)'],
                    },

                    // `[tag-content]` special attribute selector
                    {
                        actual: '$$div[tag-content="example"]',
                        expected: ['$$div:contains(example)'],
                    },

                    // `[tag-content]` special attribute selector - multiple usages
                    {
                        actual: '$$div[tag-content="a"][tag-content="b"]',
                        expected: ['$$div:contains(a):contains(b)'],
                    },

                    // `[wildcard]` special attribute selector
                    {
                        actual: '$$div[wildcard="*example*"]',
                        expected: ['$$div:contains(/^.*example.*$/)'],
                    },

                    // `[wildcard]` special attribute selector - multiple usages
                    {
                        actual: '$$div[wildcard="*example*"][wildcard="*test*"]',
                        expected: ['$$div:contains(/^.*example.*$/):contains(/^.*test.*$/)'],
                    },

                    // `:contains()` special pseudo-class selector (leave as-is)
                    {
                        actual: '$$div:contains(example)',
                        expected: ['$$div:contains(example)'],
                    },

                    // `:contains()` special pseudo-class selector (leave as-is) - multiple usages
                    {
                        actual: '$$div:contains(a):contains(b)',
                        expected: ['$$div:contains(a):contains(b)'],
                    },

                    // `:contains()` special pseudo-class selector (leave as-is) - double quotes are handled
                    {
                        actual: '$$div:contains("example")',
                        expected: ['$$div:contains("example")'],
                    },

                    // `:contains()` special pseudo-class selector (leave as-is) - single quotes are handled
                    {
                        actual: "$$div:contains('example')",
                        expected: ["$$div:contains('example')"],
                    },

                    // `:contains()` special pseudo-class selector (leave as-is) - regexp are handled
                    {
                        actual: '$$div:contains(/ex.*ple/i)',
                        expected: ['$$div:contains(/ex.*ple/i)'],
                    },

                    // `[tag-content]` and `[wildcard]` special attribute selectors - mixed usage
                    {
                        actual: '$$div[tag-content="a"][wildcard="*example*"]',
                        expected: ['$$div:contains(a):contains(/^.*example.*$/)'],
                    },

                    // `[tag-content]` and `:contains()` special simple selectors - mixed usage
                    {
                        actual: '$$div[tag-content="a"]:contains(b)',
                        expected: ['$$div:contains(a):contains(b)'],
                    },

                    // `[wildcard]` and `:contains()` special simple selectors - mixed usage
                    {
                        actual: '$$div[wildcard="*example*"]:contains(b)',
                        expected: ['$$div:contains(/^.*example.*$/):contains(b)'],
                    },

                    // `[tag-content]`, `[wildcard]` and `:contains()` special simple selectors - mixed usage
                    {
                        actual: '$$div[tag-content="a"][wildcard="*example*"]:contains(b)',
                        expected: ['$$div:contains(a):contains(/^.*example.*$/):contains(b)'],
                    },
                ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                    expect(testData).toBeConvertedProperly(
                        HtmlRuleConverter,
                        'convertToAdg',
                        parsingEnabledDefaultParserOptions,
                    );
                });
            });

            describe('parsed - invalid cases', () => {
                test.each<InvalidTestData>([
                    // invalid body - empty selector list
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        error: 'Invalid HTML filtering rule: Selector list of HTML filtering rule must not be empty',
                    },

                    // invalid selector list - empty complex selector items in complex selector
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: Complex selector of selector list must not be empty',
                    },

                    // invalid complex selector item - empty simple selectors in compound selector
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [{
                                            selector: {
                                                children: [],
                                            },
                                        }],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: Compound selector of complex selector item must not be empty',
                    },

                    // invalid complex selector item - combinator in first complex selector item
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [{
                                            combinator: {},
                                            selector: {
                                                children: [{}],
                                            },
                                        }],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: First complex selector item cannot start with a combinator',
                    },

                    // invalid complex selector item - missing combinator between complex selector items
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [{
                                            selector: {
                                                children: [{
                                                    type: 'Value',
                                                    value: 'div',
                                                }],
                                            },
                                        }, {
                                            selector: {
                                                children: [{}],
                                            },
                                        }],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: Missing combinator between complex selector items',
                    },

                    // invalid special attribute selector - value not provided
                    {
                        input: '$$[tag-content]',
                        error: 'Special attribute selector \'tag-content\' requires a value',
                    },

                    // invalid special attribute selector - invalid operator
                    {
                        input: '$$[tag-content~="value"]',
                        error: 'Special attribute selector \'tag-content\' has invalid operator \'~=\'',
                    },

                    // invalid special attribute selector - flag provided
                    {
                        input: '$$[tag-content="value" i]',
                        error: 'Special attribute selector \'tag-content\' does not support flags',
                    },

                    // invalid special attribute selector - length value not number
                    {
                        input: '$$[min-length="abc"]',
                        error: 'Value of special attribute selector \'min-length\' must be an integer, got \'abc\'',
                    },

                    // invalid special attribute selector - length value negative
                    {
                        input: '$$[min-length="-1"]',
                        // eslint-disable-next-line max-len
                        error: 'Value of special attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                    },

                    // invalid special pseudo-class selector - argument missing
                    {
                        input: '$$:contains()',
                        error: 'Special pseudo-class selector \'contains\' requires an argument',
                    },

                    // invalid compound selector - only special simple selectors
                    {
                        input: '$$[min-length="10"]',
                        error: 'Compound selector cannot contain only special simple selectors',
                    },

                    // invalid simple selector - mixed syntax (uBlock special pseudo-class selector)
                    {
                        input: '$$div:has-text(example)',
                        error: 'Invalid HTML filtering rule: Mixed AdGuard and uBlock syntax',
                    },
                ])('should not convert \'$input\'', ({ input, error }) => {
                    if (typeof input !== 'string') {
                        expect(() => {
                            HtmlRuleConverter.convertToAdg(input);
                        }).toThrowError(error);
                    } else {
                        expect(() => {
                            HtmlRuleConverter.convertToAdg(
                                RuleParser.parse(input, parsingEnabledDefaultParserOptions) as HtmlFilteringRule,
                            );
                        }).toThrowError(error);
                    }
                });
            });

            /**
             * Please not that if node is provided as raw string, we parse it first before conversion,
             * everything else is the same as in parsed tests, so we don't need to repeat many cases here.
             * It means that if the input parsing fails, the conversion will throw `AdblockSyntaxError` error.
             */
            describe('raw - valid cases', () => {
                test.each([
                    {
                        actual: '$$div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                        expected: ['$$div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)'],
                    },
                    {
                        actual: '$$div[min-length="10"]',
                        expected: ['$$div:contains(/^(?=.{10,}$).*/s)'],
                    },
                    {
                        actual: '$$div[max-length="100"]',
                        expected: ['$$div:contains(/^(?=.{0,100}$).*/s)'],
                    },
                    {
                        actual: '$$div[tag-content="example"]',
                        expected: ['$$div:contains(example)'],
                    },
                    {
                        actual: '$$div:contains(example)',
                        expected: ['$$div:contains(example)'],
                    },
                ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                    expect(testData).toBeConvertedProperly(HtmlRuleConverter, 'convertToAdg');
                });
            });

            describe('raw - invalid cases', () => {
                test.each<InvalidTestData>([
                    {
                        input: '$$[tag-content]',
                        error: 'Special attribute selector \'tag-content\' requires a value',
                    },
                    {
                        input: '$$[tag-content~="value"]',
                        error: 'Special attribute selector \'tag-content\' has invalid operator \'~=\'',
                    },
                    {
                        input: '$$[min-length="-1"]',
                        // eslint-disable-next-line max-len
                        error: 'Value of special attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                    },

                    // Parsing errors
                    {
                        input: '##^[attr="value"]div',
                        error: 'Tag selector must be first in the compound selector',
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

        describe('from uBO', () => {
            describe('parsed - valid cases', () => {
                test.each([
                    // complex selector without special simplex selectors
                    {
                        actual: '##^div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                        expected: ['$$div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)'],
                    },

                    // `:min-text-length()` special pseudo-class selector (max is conversion default)
                    {
                        actual: '##^div:min-text-length(10)',
                        expected: ['$$div:contains(/^(?=.{10,262144}$).*/s)'],
                    },

                    // `:min-text-length()` special pseudo-class selector (max is conversion default) - multiple usages
                    {
                        actual: '##^div:min-text-length(10):min-text-length(20)',
                        expected: ['$$div:contains(/^(?=.{10,262144}$).*/s):contains(/^(?=.{20,262144}$).*/s)'],
                    },

                    // `:has-text()` special pseudo-class selector
                    {
                        actual: '##^div:has-text(example)',
                        expected: ['$$div:contains(example)'],
                    },

                    // `:has-text()` special pseudo-class selector - multiple usages
                    {
                        actual: '##^div:has-text(a):has-text(b)',
                        expected: ['$$div:contains(a):contains(b)'],
                    },

                    // `:has-text()` special pseudo-class selector - double quotes are handled
                    {
                        actual: '##^div:has-text("example")',
                        expected: ['$$div:contains("example")'],
                    },

                    // `:has-text()` special pseudo-class selector - single quotes are handled
                    {
                        actual: "##^div:has-text('example')",
                        expected: ["$$div:contains('example')"],
                    },

                    // `:has-text()` special pseudo-class selector - regexp are handled
                    {
                        actual: '##^div:has-text(/ex.*ple/i)',
                        expected: ['$$div:contains(/ex.*ple/i)'],
                    },
                ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                    expect(testData).toBeConvertedProperly(
                        HtmlRuleConverter,
                        'convertToAdg',
                        parsingEnabledDefaultParserOptions,
                    );
                });
            });

            describe('parsed - invalid cases', () => {
                test.each<InvalidTestData>([
                    // invalid body - empty selector list
                    {
                        input: {
                            syntax: 'UblockOrigin',
                            body: {
                                selectorList: {
                                    children: [],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        error: 'Invalid HTML filtering rule: Selector list of HTML filtering rule must not be empty',
                    },

                    // invalid selector list - empty complex selector items in complex selector
                    {
                        input: {
                            syntax: 'UblockOrigin',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: Complex selector of selector list must not be empty',
                    },

                    // invalid complex selector item - empty simple selectors in compound selector
                    {
                        input: {
                            syntax: 'UblockOrigin',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [{
                                            selector: {
                                                children: [],
                                            },
                                        }],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: Compound selector of complex selector item must not be empty',
                    },

                    // invalid complex selector item - combinator in first complex selector item
                    {
                        input: {
                            syntax: 'UblockOrigin',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [{
                                            combinator: {},
                                            selector: {
                                                children: [{}],
                                            },
                                        }],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: First complex selector item cannot start with a combinator',
                    },

                    // invalid complex selector item - missing combinator between complex selector items
                    {
                        input: {
                            syntax: 'UblockOrigin',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [{
                                            selector: {
                                                children: [{
                                                    type: 'Value',
                                                    value: 'div',
                                                }],
                                            },
                                        }, {
                                            selector: {
                                                children: [{}],
                                            },
                                        }],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: Missing combinator between complex selector items',
                    },

                    // invalid special pseudo-class selector - argument missing
                    {
                        input: '##^:has-text()',
                        error: 'Special pseudo-class selector \'has-text\' requires an argument',
                    },

                    // invalid special pseudo-class selector - length value not number
                    {
                        input: '##^:min-text-length(abc)',
                        // eslint-disable-next-line max-len
                        error: 'Argument of special pseudo-class selector \'min-text-length\' must be an integer, got \'abc\'',
                    },

                    // invalid special pseudo-class selector - length value negative
                    {
                        input: '##^:min-text-length(-1)',
                        // eslint-disable-next-line max-len
                        error: 'Argument of special pseudo-class selector \'min-text-length\' must be a positive integer, got \'-1\'',
                    },

                    // invalid compound selector - only special simple selectors
                    {
                        input: '##^:has-text("example")',
                        error: 'Compound selector cannot contain only special simple selectors',
                    },

                    // invalid simple selector - mixed syntax (AdGuard special attribute selector)
                    {
                        input: '##^div[tag-content="example"]',
                        error: 'Invalid HTML filtering rule: Mixed AdGuard and uBlock syntax',
                    },

                    // invalid simple selector - mixed syntax (AdGuard special pseudo-class selector)
                    {
                        input: '##^div:contains(example)',
                        error: 'Invalid HTML filtering rule: Mixed AdGuard and uBlock syntax',
                    },
                ])('should not convert \'$input\'', ({ input, error }) => {
                    if (typeof input !== 'string') {
                        expect(() => {
                            HtmlRuleConverter.convertToAdg(input);
                        }).toThrowError(error);
                    } else {
                        expect(() => {
                            HtmlRuleConverter.convertToAdg(
                                RuleParser.parse(input, parsingEnabledDefaultParserOptions) as HtmlFilteringRule,
                            );
                        }).toThrowError(error);
                    }
                });
            });

            /**
             * Please not that if node is provided as raw string, we parse it first before conversion,
             * everything else is the same as in parsed tests, so we don't need to repeat many cases here.
             * It means that if the input parsing fails, the conversion will throw `AdblockSyntaxError` error.
             */
            describe('raw - valid cases', () => {
                test.each([
                    {
                        actual: '##^div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                        expected: ['$$div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)'],
                    },
                    {
                        actual: '##^div:min-text-length(10)',
                        expected: ['$$div:contains(/^(?=.{10,262144}$).*/s)'],
                    },
                    {
                        actual: '##^div:has-text(example)',
                        expected: ['$$div:contains(example)'],
                    },
                ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                    expect(testData).toBeConvertedProperly(HtmlRuleConverter, 'convertToAdg');
                });
            });

            describe('raw - invalid cases', () => {
                test.each<InvalidTestData>([
                    {
                        input: '##^:has-text()',
                        error: 'Special pseudo-class selector \'has-text\' requires an argument',
                    },
                    {
                        input: '##^:min-text-length(abc)',
                        // eslint-disable-next-line max-len
                        error: 'Argument of special pseudo-class selector \'min-text-length\' must be an integer, got \'abc\'',
                    },
                    {
                        input: '##^:min-text-length(-1)',
                        // eslint-disable-next-line max-len
                        error: 'Argument of special pseudo-class selector \'min-text-length\' must be a positive integer, got \'-1\'',
                    },

                    // Parsing errors
                    {
                        input: '##^[attr="value"]div',
                        error: 'Tag selector must be first in the compound selector',
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
    });

    describe('convertToUbo', () => {
        describe('from ABP', () => {
            test('should throw unsupported error', () => {
                expect(() => HtmlRuleConverter.convertToUbo({
                    syntax: 'AdblockPlus',
                } as HtmlFilteringRule)).toThrowError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
            });
        });

        describe('from ADG', () => {
            describe('parsed - valid cases', () => {
                test.each([
                    // complex selector without special simple selectors
                    {
                        actual: '$$div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                        expected: ['##^div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)'],
                    },

                    // `[min-length]` special attribute selector
                    {
                        actual: '$$div[min-length="10"]',
                        expected: ['##^div:min-text-length(10)'],
                    },

                    // `[min-length]` special attribute selector - multiple usages
                    {
                        actual: '$$div[min-length="10"][min-length="20"]',
                        expected: ['##^div:min-text-length(10):min-text-length(20)'],
                    },

                    // `[max-length]` special attribute selector (ignored during conversion)
                    {
                        actual: '$$div[max-length="100"]',
                        expected: ['##^div'],
                    },

                    // `[max-length]` special attribute selector (ignored during conversion) - multiple usages
                    {
                        actual: '$$div[max-length="100"][max-length="200"]',
                        expected: ['##^div'],
                    },

                    // `[tag-content]` special attribute selector
                    {
                        actual: '$$div[tag-content="example"]',
                        expected: ['##^div:has-text(example)'],
                    },

                    // `[tag-content]` special attribute selector - multiple usages
                    {
                        actual: '$$div[tag-content="a"][tag-content="b"]',
                        expected: ['##^div:has-text(a):has-text(b)'],
                    },

                    // `[wildcard]` special attribute selector
                    {
                        actual: '$$div[wildcard="*example*"]',
                        expected: ['##^div:has-text(/^.*example.*$/)'],
                    },

                    // `[wildcard]` special attribute selector - multiple usages
                    {
                        actual: '$$div[wildcard="*example*"][wildcard="*test*"]',
                        expected: ['##^div:has-text(/^.*example.*$/):has-text(/^.*test.*$/)'],
                    },

                    // `:contains()` special pseudo-class selector
                    {
                        actual: '$$div:contains(example)',
                        expected: ['##^div:has-text(example)'],
                    },

                    // `:contains()` special pseudo-class selector - multiple usages
                    {
                        actual: '$$div:contains(a):contains(b)',
                        expected: ['##^div:has-text(a):has-text(b)'],
                    },

                    // `:contains()` special pseudo-class selector - double quotes are handled
                    {
                        actual: '$$div:contains("example")',
                        expected: ['##^div:has-text("example")'],
                    },

                    // `:contains()` special pseudo-class selector - single quotes are handled
                    {
                        actual: "$$div:contains('example')",
                        expected: ["##^div:has-text('example')"],
                    },

                    // `:contains()` special pseudo-class selector - regexp are handled
                    {
                        actual: '$$div:contains(/ex.*ple/i)',
                        expected: ['##^div:has-text(/ex.*ple/i)'],
                    },

                    // `[tag-content]` and `[wildcard]` special attribute selectors - mixed usage
                    {
                        actual: '$$div[tag-content="a"][wildcard="*example*"]',
                        expected: ['##^div:has-text(a):has-text(/^.*example.*$/)'],
                    },

                    // `[tag-content]` and `:contains()` special simple selectors - mixed usage
                    {
                        actual: '$$div[tag-content="a"]:contains(b)',
                        expected: ['##^div:has-text(a):has-text(b)'],
                    },

                    // `[wildcard]` and `:contains()` special simple selectors - mixed usage
                    {
                        actual: '$$div[wildcard="*example*"]:contains(b)',
                        expected: ['##^div:has-text(/^.*example.*$/):has-text(b)'],
                    },

                    // `[tag-content]`, `[wildcard]` and `:contains()` special simple selectors - mixed usage
                    {
                        actual: '$$div[tag-content="a"][wildcard="*example*"]:contains(b)',
                        expected: ['##^div:has-text(a):has-text(/^.*example.*$/):has-text(b)'],
                    },
                ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                    expect(testData).toBeConvertedProperly(
                        HtmlRuleConverter,
                        'convertToUbo',
                        parsingEnabledDefaultParserOptions,
                    );
                });
            });

            describe('parsed - invalid cases', () => {
                test.each<InvalidTestData>([
                    // invalid body - empty selector list
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        error: 'Invalid HTML filtering rule: Selector list of HTML filtering rule must not be empty',
                    },

                    // invalid selector list - empty complex selector items in complex selector
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: Complex selector of selector list must not be empty',
                    },

                    // invalid complex selector item - empty simple selectors in compound selector
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [{
                                            selector: {
                                                children: [],
                                            },
                                        }],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: Compound selector of complex selector item must not be empty',
                    },

                    // invalid complex selector item - combinator in first complex selector item
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [{
                                            combinator: {},
                                            selector: {
                                                children: [{}],
                                            },
                                        }],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: First complex selector item cannot start with a combinator',
                    },

                    // invalid complex selector item - missing combinator between complex selector items
                    {
                        input: {
                            syntax: 'AdGuard',
                            body: {
                                selectorList: {
                                    children: [{
                                        children: [{
                                            selector: {
                                                children: [{
                                                    type: 'Value',
                                                    value: 'div',
                                                }],
                                            },
                                        }, {
                                            selector: {
                                                children: [{}],
                                            },
                                        }],
                                    }],
                                },
                            },
                        } as unknown as HtmlFilteringRule,
                        // eslint-disable-next-line max-len
                        error: 'Invalid HTML filtering rule: Missing combinator between complex selector items',
                    },

                    // invalid special attribute selector - value not provided
                    {
                        input: '$$[tag-content]',
                        error: 'Special attribute selector \'tag-content\' requires a value',
                    },

                    // invalid special attribute selector - invalid operator
                    {
                        input: '$$[tag-content~="value"]',
                        error: 'Special attribute selector \'tag-content\' has invalid operator \'~=\'',
                    },

                    // invalid special attribute selector - flag provided
                    {
                        input: '$$[tag-content="value" i]',
                        error: 'Special attribute selector \'tag-content\' does not support flags',
                    },

                    // invalid special attribute selector - length value not number
                    {
                        input: '$$[min-length="abc"]',
                        error: 'Value of special attribute selector \'min-length\' must be an integer, got \'abc\'',
                    },

                    // invalid special attribute selector - length value negative
                    {
                        input: '$$[min-length="-1"]',
                        // eslint-disable-next-line max-len
                        error: 'Value of special attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                    },

                    // invalid special pseudo-class selector - argument missing
                    {
                        input: '$$:contains()',
                        error: 'Special pseudo-class selector \'contains\' requires an argument',
                    },

                    // invalid compound selector - only special simple selectors
                    {
                        input: '$$[min-length="10"]',
                        error: 'Compound selector cannot contain only special simple selectors',
                    },

                    // invalid simple selector - mixed syntax (uBlock special pseudo-class selector)
                    {
                        input: '$$div:has-text(example)',
                        error: 'Invalid HTML filtering rule: Mixed AdGuard and uBlock syntax',
                    },
                ])('should not convert \'$input\'', ({ input, error }) => {
                    if (typeof input !== 'string') {
                        expect(() => {
                            HtmlRuleConverter.convertToUbo(input);
                        }).toThrowError(error);
                    } else {
                        expect(() => {
                            HtmlRuleConverter.convertToUbo(
                                RuleParser.parse(input, parsingEnabledDefaultParserOptions) as HtmlFilteringRule,
                            );
                        }).toThrowError(error);
                    }
                });
            });

            /**
             * Please not that if node is provided as raw string, we parse it first before conversion,
             * everything else is the same as in parsed tests, so we don't need to repeat many cases here.
             * It means that if the input parsing fails, the conversion will throw `AdblockSyntaxError` error.
             */
            describe('raw - valid cases', () => {
                test.each([
                    {
                        actual: '$$div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                        expected: ['##^div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)'],
                    },
                    {
                        actual: '$$div[min-length="10"]',
                        expected: ['##^div:min-text-length(10)'],
                    },
                    {
                        actual: '$$div[max-length="100"]',
                        expected: ['##^div'],
                    },
                    {
                        actual: '$$div[tag-content="example"]',
                        expected: ['##^div:has-text(example)'],
                    },
                    {
                        actual: '$$div:contains(example)',
                        expected: ['##^div:has-text(example)'],
                    },
                ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                    expect(testData).toBeConvertedProperly(HtmlRuleConverter, 'convertToUbo');
                });
            });

            describe('raw - invalid cases', () => {
                test.each<InvalidTestData>([
                    {
                        input: '$$[tag-content]',
                        error: 'Special attribute selector \'tag-content\' requires a value',
                    },
                    {
                        input: '$$[tag-content~="value"]',
                        error: 'Special attribute selector \'tag-content\' has invalid operator \'~=\'',
                    },
                    {
                        input: '$$[min-length="-1"]',
                        // eslint-disable-next-line max-len
                        error: 'Value of special attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                    },

                    // Parsing errors
                    {
                        input: '$$[attr="value"]div',
                        error: 'Tag selector must be first in the compound selector',
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

        describe('from uBO', () => {
            test('should not convert and return the same rule', () => {
                const rule = {
                    syntax: 'UblockOrigin',
                } as HtmlFilteringRule;

                expect(HtmlRuleConverter.convertToUbo(rule)).toEqual(createNodeConversionResult([rule], false));
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
