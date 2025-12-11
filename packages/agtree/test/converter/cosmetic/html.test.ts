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
    parseHtmlFilteringRules: true,
};

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

        describe('from uBO - valid cases (parsed)', () => {
            test.each([
                // complex selector without special parts
                {
                    actual: '##^div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                    // eslint-disable-next-line max-len
                    expected: ['$$div[attr="value"][max-length="262144"] + span:nth-child(2)[max-length="262144"] > a[href^="https"]:not(.className)[max-length="262144"]'],
                },

                // `:min-text-length()` special pseudo-class
                {
                    actual: '##^div:min-text-length(10)',
                    expected: ['$$div[min-length="10"][max-length="262144"]'],
                },

                // `:has-text()` special pseudo-class
                {
                    actual: '##^div:has-text(example)',
                    expected: ['$$div[max-length="262144"]:contains(example)'],
                },

                // `:has-text()` special pseudo-class - double quotes are handled
                {
                    actual: '##^div:has-text("example")',
                    expected: ['$$div[max-length="262144"]:contains("example")'],
                },

                // `:has-text()` special pseudo-class - single quotes are handled
                {
                    actual: "##^div:has-text('example')",
                    expected: ["$$div[max-length=\"262144\"]:contains('example')"],
                },

                // `:has-text()` special pseudo-class - regexp are handled
                {
                    actual: '##^div:has-text(/ex.*ple/i)',
                    expected: ['$$div[max-length="262144"]:contains(/ex.*ple/i)'],
                },

                // edge case - `[min-length]` (ADG attr) ignored when `:min-text-length()` is present
                {
                    actual: '##^div[min-length="5"]:min-text-length(10)',
                    expected: ['$$div[min-length="10"][max-length="262144"]'],
                },

                // edge case - `[tag-content]` (ADG attr) ignored when `:has-text()` is present
                {
                    actual: '##^div[tag-content="a"]:has-text(b)',
                    expected: ['$$div[max-length="262144"]:contains(b)'],
                },

                // edge case - `[tag-content]` (ADG attr) ignored when `:contains()` is present
                {
                    actual: '##^div[tag-content="a"]:contains(b)',
                    expected: ['$$div[max-length="262144"]:contains(b)'],
                },

                // edge case - `[min-length]` de-duplication - latter takes precedence
                {
                    actual: '##^div[min-length="2000"][min-length="1000"]',
                    expected: ['$$div[min-length="1000"][max-length="262144"]'],
                },

                // edge case - `:min-text-length()` de-duplication - latter takes precedence
                {
                    actual: '##^div:min-text-length(2000):min-text-length(1000)',
                    expected: ['$$div[min-length="1000"][max-length="262144"]'],
                },

                // edge case - `[max-length]` de-duplication - latter takes precedence
                {
                    actual: '##^div[max-length="2000"][max-length="1000"]',
                    expected: ['$$div[max-length="1000"]'],
                },

                // edge case - `[tag-content]` de-duplication - latter takes precedence
                {
                    actual: '##^div[tag-content="a"][tag-content="b"]',
                    expected: ['$$div[max-length="262144"]:contains(b)'],
                },

                // edge case - `:has-text()` de-duplication - latter takes precedence
                {
                    actual: '##^div:has-text(a):has-text(b)',
                    expected: ['$$div[max-length="262144"]:contains(b)'],
                },

                // edge case - `:contains()` de-duplication - latter takes precedence
                {
                    actual: '##^div:contains(a):contains(b)',
                    expected: ['$$div[max-length="262144"]:contains(b)'],
                },

                // edge case - `:contains()` and `:has-text()` de-duplication - latter takes precedence
                {
                    actual: '##^div:contains(a):has-text(b)',
                    expected: ['$$div[max-length="262144"]:contains(b)'],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(
                    HtmlRuleConverter,
                    'convertToAdg',
                    parsingEnabledDefaultParserOptions,
                );
            });
        });

        describe('from uBO - invalid cases (parsed)', () => {
            test.each<InvalidTestData>([
                /* Common cases */
                // invalid body - empty selector list
                {
                    input: {
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

                // invalid selector - empty simple selectors in compound selector
                {
                    input: {
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

                // invalid selector - combinator in first complex selector item
                {
                    input: {
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

                // invalid selector - missing combinator between complex selector items
                {
                    input: {
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
                    input: '##^[tag-content]',
                    error: 'Special attribute selector \'tag-content\' requires a value',
                },

                // invalid special attribute selector - invalid operator
                {
                    input: '##^[tag-content~="value"]',
                    error: 'Special attribute selector \'tag-content\' has invalid operator \'~=\'',
                },

                // invalid special attribute selector - flag provided
                {
                    input: '##^[tag-content="value" i]',
                    error: 'Special attribute selector \'tag-content\' does not support flags',
                },

                // invalid special attribute selector - length value not number
                {
                    input: '##^[min-length="abc"]',
                    error: 'Value of special attribute selector \'min-length\' must be an integer, got \'abc\'',
                },

                // invalid special attribute selector - length value negative
                {
                    input: '##^[min-length="-1"]',
                    error: 'Value of special attribute selector \'min-length\' must be a positive integer, got \'-1\'',
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

                // invalid special pseudo-class selector - length value not number
                {
                    input: '##^:min-text-length(-1)',
                    // eslint-disable-next-line max-len
                    error: 'Argument of special pseudo-class selector \'min-text-length\' must be a positive integer, got \'-1\'',
                },

                // invalid compound selector - only special simple selectors
                {
                    input: '##^[min-length="10"]:has-text("example")',
                    error: 'Compound selector cannot contain only special simple selectors',
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
        describe('from uBO - valid cases (raw)', () => {
            test.each([
                {
                    actual: '##^div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                    // eslint-disable-next-line max-len
                    expected: ['$$div[attr="value"][max-length="262144"] + span:nth-child(2)[max-length="262144"] > a[href^="https"]:not(.className)[max-length="262144"]'],
                },
                {
                    actual: '##^div:min-text-length(10)',
                    expected: ['$$div[min-length="10"][max-length="262144"]'],
                },
                {
                    actual: '##^div:has-text(example)',
                    expected: ['$$div[max-length="262144"]:contains(example)'],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(HtmlRuleConverter, 'convertToAdg');
            });
        });

        describe('from uBO - invalid cases (raw)', () => {
            test.each<InvalidTestData>([
                {
                    input: '##^[tag-content]',
                    error: 'Special attribute selector \'tag-content\' requires a value',
                },
                {
                    input: '##^[tag-content~="value"]',
                    error: 'Special attribute selector \'tag-content\' has invalid operator \'~=\'',
                },
                {
                    input: '##^:has-text()',
                    error: 'Special pseudo-class \'has-text\' requires an argument',
                },
                {
                    input: '##^:min-text-length(abc)',
                    error: 'Argument of special pseudo-class \'min-text-length\' must be an integer, got \'abc\'',
                },
                {
                    input: '##^:min-text-length(-1)',
                    // eslint-disable-next-line max-len
                    error: 'Argument of special pseudo-class \'min-text-length\' must be a positive integer, got \'-1\'',
                },

                // Parsing errors
                {
                    input: '##^[attr="value"]div',
                    error: 'Tag name must be the first part of the selector',
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

        describe('from ADG - valid cases (parsed)', () => {
            test.each([
                // complex selector without special parts
                {
                    actual: '$$div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                    expected: ['##^div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)'],
                },

                // `[min-length]` special attribute
                {
                    actual: '$$div[min-length="10"]',
                    expected: ['##^div:min-text-length(10)'],
                },

                // `[max-length]` special attribute is ignored during conversion
                {
                    actual: '$$div[max-length="100"]',
                    expected: ['##^div'],
                },

                // `[tag-content]` special attribute
                {
                    actual: '$$div[tag-content="example"]',
                    expected: ['##^div:has-text(example)'],
                },

                // `:contains()` special pseudo-class
                {
                    actual: '$$div:contains(example)',
                    expected: ['##^div:has-text(example)'],
                },

                // `:contains()` special pseudo-class - double quotes are handled
                {
                    actual: '$$div:contains("example")',
                    expected: ['##^div:has-text("example")'],
                },

                // `:contains()` special pseudo-class - single quotes are handled
                {
                    actual: "$$div:contains('example')",
                    expected: ["##^div:has-text('example')"],
                },

                // `:contains()` special pseudo-class - regexp are handled
                {
                    actual: '$$div:contains(/ex.*ple/i)',
                    expected: ['##^div:has-text(/ex.*ple/i)'],
                },

                // edge case - `[min-length]` ignored when `:min-text-length()` (uBO pseudo-class) is present
                {
                    actual: '$$div[min-length="5"]:min-text-length(10)',
                    expected: ['##^div:min-text-length(10)'],
                },

                // edge case - `[tag-content]` ignored when `:has-text()` (uBO pseudo-class) is present
                {
                    actual: '$$div[tag-content="a"]:has-text(b)',
                    expected: ['##^div:has-text(b)'],
                },

                // edge case - `[tag-content]` ignored when `:contains()` (uBO pseudo-class) is present
                {
                    actual: '$$div[tag-content="a"]:contains(b)',
                    expected: ['##^div:has-text(b)'],
                },

                // edge case - `[min-length]` de-duplication - latter takes precedence
                {
                    actual: '$$div[min-length="2000"][min-length="1000"]',
                    expected: ['##^div:min-text-length(1000)'],
                },

                // edge case - `:min-text-length()` de-duplication - latter takes precedence
                {
                    actual: '$$div:min-text-length(2000):min-text-length(1000)',
                    expected: ['##^div:min-text-length(1000)'],
                },

                // edge case - `[tag-content]` de-duplication - latter takes precedence
                {
                    actual: '$$div[tag-content="a"][tag-content="b"]',
                    expected: ['##^div:has-text(b)'],
                },

                // edge case - `:has-text()` de-duplication - latter takes precedence
                {
                    actual: '$$div:has-text(a):has-text(b)',
                    expected: ['##^div:has-text(b)'],
                },

                // edge case - `:contains()` de-duplication - latter takes precedence
                {
                    actual: '$$div:contains(a):contains(b)',
                    expected: ['##^div:has-text(b)'],
                },

                // edge case - `:has-text()` and `:contains()` de-duplication - latter takes precedence
                {
                    actual: '$$div:has-text(a):contains(b)',
                    expected: ['##^div:has-text(b)'],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(
                    HtmlRuleConverter,
                    'convertToUbo',
                    parsingEnabledDefaultParserOptions,
                );
            });
        });

        describe('from ADG - invalid cases (parsed)', () => {
            test.each<InvalidTestData>([
                /* Common cases */
                // invalid body - empty selector list
                {
                    input: {
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

                // invalid selector - empty simple selectors in compound selector
                {
                    input: {
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

                // invalid selector - combinator in first complex selector item
                {
                    input: {
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

                // invalid selector - missing combinator between complex selector items
                {
                    input: {
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
                    error: 'Value of special attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                },

                // invalid special pseudo-class selector - argument missing
                {
                    input: '$$:has-text()',
                    error: 'Special pseudo-class selector \'has-text\' requires an argument',
                },

                // invalid special pseudo-class selector - length value not number
                {
                    input: '$$:min-text-length(abc)',
                    // eslint-disable-next-line max-len
                    error: 'Argument of special pseudo-class selector \'min-text-length\' must be an integer, got \'abc\'',
                },

                // invalid special pseudo-class selector - length value not number
                {
                    input: '$$:min-text-length(-1)',
                    // eslint-disable-next-line max-len
                    error: 'Argument of special pseudo-class selector \'min-text-length\' must be a positive integer, got \'-1\'',
                },

                // invalid compound selector - only special simple selectors
                {
                    input: '$$[min-length="10"]:has-text("example")',
                    error: 'Compound selector cannot contain only special simple selectors',
                },

                /* ADG -> uBO specific cases */
                // can't convert `[wildcard]` attribute
                {
                    input: '$$[wildcard="example"]',
                    error: 'Special attribute selector \'wildcard\' is not supported in conversion',
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
        describe('from ADG - valid cases (raw)', () => {
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

        describe('from ADG - invalid cases (raw)', () => {
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
                    error: 'Value of special attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                },
                {
                    input: '$$[wildcard="example"]',
                    error: 'Special attribute selector \'wildcard\' is not supported in conversion',
                },

                // Parsing errors
                {
                    input: '$$[attr="value"]div',
                    error: 'Tag name must be the first part of the selector',
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
