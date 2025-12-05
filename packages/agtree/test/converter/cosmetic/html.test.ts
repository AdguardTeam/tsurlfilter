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
                // complex selector without special parts
                {
                    actual: '##^div[attr="value"] + span:nth-child(2) > a[href^="https"]:not(.className)',
                    // eslint-disable-next-line max-len
                    expected: ['$$div[attr="value"][max-length="262144"] + span:nth-child(2)[max-length="262144"] > a[href^="https"]:not(.className)[max-length="262144"]'],
                },

                // `:min-text-length()` special pseudo class
                {
                    actual: '##^div:min-text-length(10)',
                    expected: ['$$div[min-length="10"][max-length="262144"]'],
                },

                // `:has-text()` special pseudo class
                {
                    actual: '##^div:has-text(example)',
                    expected: ['$$div[tag-content="example"][max-length="262144"]'],
                },

                // `:has-text()` special pseudo class - double quotes are handled
                {
                    actual: '##^div:has-text("example")',
                    expected: ['$$div[tag-content="example"][max-length="262144"]'],
                },

                // `:has-text()` special pseudo class - single quotes are handled
                {
                    actual: "##^div:has-text('example')",
                    expected: ['$$div[tag-content="example"][max-length="262144"]'],
                },

                // mix of multiple `[min-length]` special attributes - latter takes precedence
                {
                    actual: '##^div[min-length="5"][min-length="10"]',
                    expected: ['$$div[min-length="10"][max-length="262144"]'],
                },

                // mix of multiple `[min-length]` special attributes - latter takes precedence
                {
                    actual: '##^div[min-length="10"][min-length="5"]',
                    expected: ['$$div[min-length="5"][max-length="262144"]'],
                },

                // mix of multiple `:min-text-length()` special pseudo classes - latter takes precedence
                {
                    actual: '##^div:min-text-length(5):min-text-length(10)',
                    expected: ['$$div[min-length="10"][max-length="262144"]'],
                },

                // mix of multiple `:min-text-length()` special pseudo classes - latter takes precedence
                {
                    actual: '##^div:min-text-length(10):min-text-length(5)',
                    expected: ['$$div[min-length="5"][max-length="262144"]'],
                },

                // mix of `[min-length]` special attribute
                // and `:min-text-length()` special pseudo class
                // latter takes precedence
                {
                    actual: '##^div[min-length="5"]:min-text-length(10)',
                    expected: ['$$div[min-length="10"][max-length="262144"]'],
                },

                // mix of `:min-text-length()` special pseudo class
                // and `[min-length]` special attribute
                // latter takes precedence
                {
                    actual: '##^div:min-text-length(10)[min-length="5"]',
                    expected: ['$$div[min-length="5"][max-length="262144"]'],
                },

                // mix of multiple `[tag-content]` special attributes - latter takes precedence
                {
                    actual: '##^div[tag-content="a"][tag-content="b"]',
                    expected: ['$$div[tag-content="b"][max-length="262144"]'],
                },

                // mix of multiple `[tag-content]` special attributes - latter takes precedence
                {
                    actual: '##^div[tag-content="b"][tag-content="a"]',
                    expected: ['$$div[tag-content="a"][max-length="262144"]'],
                },

                // mix of multiple `:has-text()` special pseudo classes - latter takes precedence
                {
                    actual: '##^div:has-text(a):has-text(b)',
                    expected: ['$$div[tag-content="b"][max-length="262144"]'],
                },

                // mix of multiple `:has-text()` special pseudo classes - latter takes precedence
                {
                    actual: '##^div:has-text(b):has-text(a)',
                    expected: ['$$div[tag-content="a"][max-length="262144"]'],
                },

                // mix of `[tag-content]` special attribute
                // and `:has-text()` special pseudo class
                // latter takes precedence
                {
                    actual: '##^div[tag-content="a"]:has-text(b)',
                    expected: ['$$div[tag-content="b"][max-length="262144"]'],
                },

                // mix of `:has-text()` special pseudo class
                // and `[tag-content]` special attribute
                // latter takes precedence
                {
                    actual: '##^div[tag-content="b"]:has-text(a)',
                    expected: ['$$div[tag-content="a"][max-length="262144"]'],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(HtmlRuleConverter, 'convertToAdg');
            });
        });

        describe('from uBO - invalid cases', () => {
            test.each<InvalidTestData>([
                /* Common cases */
                // invalid body - empty selector list
                {
                    input: {
                        body: {
                            children: [],
                        },
                    } as unknown as HtmlFilteringRule,
                    error: 'Invalid HTML filtering rule: HTML filtering rule must contain at least one selector list',
                },

                // invalid selector list - empty selector in selector list
                {
                    input: {
                        body: {
                            children: [{
                                children: [],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: HTML filtering rule must contain at least one selector in selector list',
                },

                // invalid selector - empty parts in selector
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: HTML filtering rule must contain at least one part in selector',
                },

                // invalid selector - combinator in first selector
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{}],
                                    combinator: {},
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: First selector cannot start with a combinator',
                },

                // invalid selector - missing combinator between selectors
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'Value',
                                        value: 'div',
                                    }],
                                }, {
                                    children: [{}],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Missing combinator between selectors',
                },

                // invalid attribute - operator without value
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'HtmlFilteringRuleSelectorAttribute',
                                        operator: {},
                                    }],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Attribute selector operator specified without a value',
                },

                // invalid attribute - flag without value
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'HtmlFilteringRuleSelectorAttribute',
                                        flag: {},
                                    }],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Attribute selector flag specified without a value',
                },

                // invalid attribute - value without operator
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'HtmlFilteringRuleSelectorAttribute',
                                        value: {},
                                    }],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Attribute selector value specified without an operator',
                },

                // invalid pseudo class - argument without flag
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'HtmlFilteringRuleSelectorPseudoClass',
                                        argument: {},
                                    }],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Non-function pseudo class cannot have an argument',
                },

                // invalid special attribute - value not provided
                {
                    input: '##^[tag-content]',
                    error: 'Special attribute selector \'tag-content\' requires a value',
                },

                // invalid special attribute - invalid operator
                {
                    input: '##^[tag-content~="value"]',
                    error: 'Special attribute selector \'tag-content\' has invalid operator \'~=\'',
                },

                // invalid special attribute - flag provided
                {
                    input: '##^[tag-content="value" i]',
                    error: 'Special attribute selector \'tag-content\' does not support flags',
                },

                // invalid special attribute - length value not number
                {
                    input: '##^[min-length="abc"]',
                    error: 'Value of special attribute selector \'min-length\' must be an integer, got \'abc\'',
                },

                // invalid special attribute - length value negative
                {
                    input: '##^[min-length="-1"]',
                    error: 'Value of special attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                },

                // invalid special pseudo class - argument missing
                {
                    input: '##^:has-text()',
                    error: 'Special pseudo class \'has-text\' requires an argument',
                },

                // invalid special pseudo class - length value not number
                {
                    input: '##^:min-text-length(abc)',
                    error: 'Argument of special pseudo class \'min-text-length\' must be an integer, got \'abc\'',
                },

                // invalid special pseudo class - length value not number
                {
                    input: '##^:min-text-length(-1)',
                    // eslint-disable-next-line max-len
                    error: 'Argument of special pseudo class \'min-text-length\' must be a positive integer, got \'-1\'',
                },

                // invalid selector - only special parts
                {
                    input: '##^[min-length="10"]:has-text("example")',
                    error: 'Selector cannot contain only special attribute selectors or pseudo classes',
                },

                /* uBO -> ADG specific cases */
                // can't convert regexp in `:has-text()` pseudo class
                {
                    input: '##^:has-text(/example/)',
                    // eslint-disable-next-line max-len
                    error: 'Argument of special pseudo class \'has-text\' is a regular expression, which is not supported',
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

                // mix of multiple `[min-length]` special attributes - latter takes precedence
                {
                    actual: '$$div[min-length="5"][min-length="10"]',
                    expected: ['##^div:min-text-length(10)'],
                },

                // mix of multiple `[min-length]` special attributes - latter takes precedence
                {
                    actual: '$$div[min-length="10"][min-length="5"]',
                    expected: ['##^div:min-text-length(5)'],
                },

                // mix of multiple `:min-text-length()` special pseudo classes - latter takes precedence
                {
                    actual: '$$div:min-text-length(5):min-text-length(10)',
                    expected: ['##^div:min-text-length(10)'],
                },

                // mix of multiple `:min-text-length()` special pseudo classes - latter takes precedence
                {
                    actual: '$$div:min-text-length(10):min-text-length(5)',
                    expected: ['##^div:min-text-length(5)'],
                },

                // mix of `[min-length]` special attribute
                // and `:min-text-length()` special pseudo class
                // latter takes precedence
                {
                    actual: '$$div[min-length="5"]:min-text-length(10)',
                    expected: ['##^div:min-text-length(10)'],
                },

                // mix of `:min-text-length()` special pseudo class
                // and `[min-length]` special attribute
                // latter takes precedence
                {
                    actual: '$$div:min-text-length(10)[min-length="5"]',
                    expected: ['##^div:min-text-length(5)'],
                },

                // mix of multiple `[tag-content]` special attributes - latter takes precedence
                {
                    actual: '$$div[tag-content="a"][tag-content="b"]',
                    expected: ['##^div:has-text(b)'],
                },

                // mix of multiple `[tag-content]` special attributes - latter takes precedence
                {
                    actual: '$$div[tag-content="b"][tag-content="a"]',
                    expected: ['##^div:has-text(a)'],
                },

                // mix of multiple `:has-text()` special pseudo classes - latter takes precedence
                {
                    actual: '$$div:has-text(a):has-text(b)',
                    expected: ['##^div:has-text(b)'],
                },

                // mix of multiple `:has-text()` special pseudo classes - latter takes precedence
                {
                    actual: '$$div:has-text(b):has-text(a)',
                    expected: ['##^div:has-text(a)'],
                },

                // mix of `[tag-content]` special attribute
                // and `:has-text()` special pseudo class
                // latter takes precedence
                {
                    actual: '$$div[tag-content="a"]:has-text(b)',
                    expected: ['##^div:has-text(b)'],
                },

                // mix of `:has-text()` special pseudo class
                // and `[tag-content]` special attribute
                // latter takes precedence
                {
                    actual: '$$div[tag-content="b"]:has-text(a)',
                    expected: ['##^div:has-text(a)'],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(HtmlRuleConverter, 'convertToUbo');
            });
        });

        describe('from ADG - invalid cases', () => {
            test.each<InvalidTestData>([
                /* Common cases */
                // invalid body - empty selector list
                {
                    input: {
                        body: {
                            children: [],
                        },
                    } as unknown as HtmlFilteringRule,
                    error: 'Invalid HTML filtering rule: HTML filtering rule must contain at least one selector list',
                },

                // invalid selector list - empty selector in selector list
                {
                    input: {
                        body: {
                            children: [{
                                children: [],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: HTML filtering rule must contain at least one selector in selector list',
                },

                // invalid selector - empty parts in selector
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: HTML filtering rule must contain at least one part in selector',
                },

                // invalid selector - combinator in first selector
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{}],
                                    combinator: {},
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: First selector cannot start with a combinator',
                },

                // invalid selector - missing combinator between selectors
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'Value',
                                        value: 'div',
                                    }],
                                }, {
                                    children: [{}],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Missing combinator between selectors',
                },

                // invalid attribute - operator without value
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'HtmlFilteringRuleSelectorAttribute',
                                        operator: {},
                                    }],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Attribute selector operator specified without a value',
                },

                // invalid attribute - flag without value
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'HtmlFilteringRuleSelectorAttribute',
                                        flag: {},
                                    }],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Attribute selector flag specified without a value',
                },

                // invalid attribute - value without operator
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'HtmlFilteringRuleSelectorAttribute',
                                        value: {},
                                    }],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Attribute selector value specified without an operator',
                },

                // invalid pseudo class - argument without flag
                {
                    input: {
                        body: {
                            children: [{
                                children: [{
                                    children: [{
                                        type: 'HtmlFilteringRuleSelectorPseudoClass',
                                        argument: {},
                                    }],
                                }],
                            }],
                        },
                    } as unknown as HtmlFilteringRule,
                    // eslint-disable-next-line max-len
                    error: 'Invalid HTML filtering rule: Non-function pseudo class cannot have an argument',
                },

                // invalid special attribute - value not provided
                {
                    input: '$$[tag-content]',
                    error: 'Special attribute selector \'tag-content\' requires a value',
                },

                // invalid special attribute - invalid operator
                {
                    input: '$$[tag-content~="value"]',
                    error: 'Special attribute selector \'tag-content\' has invalid operator \'~=\'',
                },

                // invalid special attribute - flag provided
                {
                    input: '$$[tag-content="value" i]',
                    error: 'Special attribute selector \'tag-content\' does not support flags',
                },

                // invalid special attribute - length value not number
                {
                    input: '$$[min-length="abc"]',
                    error: 'Value of special attribute selector \'min-length\' must be an integer, got \'abc\'',
                },

                // invalid special attribute - length value negative
                {
                    input: '$$[min-length="-1"]',
                    error: 'Value of special attribute selector \'min-length\' must be a positive integer, got \'-1\'',
                },

                // invalid special pseudo class - argument missing
                {
                    input: '$$:has-text()',
                    error: 'Special pseudo class \'has-text\' requires an argument',
                },

                // invalid special pseudo class - length value not number
                {
                    input: '$$:min-text-length(abc)',
                    error: 'Argument of special pseudo class \'min-text-length\' must be an integer, got \'abc\'',
                },

                // invalid special pseudo class - length value not number
                {
                    input: '$$:min-text-length(-1)',
                    // eslint-disable-next-line max-len
                    error: 'Argument of special pseudo class \'min-text-length\' must be a positive integer, got \'-1\'',
                },

                // invalid selector - only special parts
                {
                    input: '$$[min-length="10"]:has-text("example")',
                    error: 'Selector cannot contain only special attribute selectors or pseudo classes',
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
