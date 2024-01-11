import { type Modifier } from '../../src/parser/common';
import { ModifierParser } from '../../src/parser/misc/modifier';
import { modifierValidator } from '../../src/validator';
import { StringUtils } from '../../src/utils/string';
import { VALIDATION_ERROR_PREFIX } from '../../src/validator/constants';
import { AdblockSyntax } from '../../src/utils/adblockers';
import { LIST_PARSE_ERROR_PREFIX } from '../../src/parser/misc/list-helpers';

const DOCS_BASE_URL = {
    ADG: 'https://adguard.app/kb/general/ad-filtering/create-own-filters/',
    UBO: 'https://github.com/gorhill/uBlock/wiki/Static-filter-syntax',
    ABP: 'https://help.adblockplus.org/',
};

/**
 * Returns modifier AST node for given rawModifier.
 *
 * @param rawModifier String or modifier AST node.
 *
 * @returns Parsed Modifier or null if given modifier is invalid.
 * @throws If given `rawModifier` cannot be parsed into Modifier.
 */
const getModifier = (rawModifier: string | Modifier): Modifier => {
    let modifier: Modifier;
    if (StringUtils.isString(rawModifier)) {
        // no try..catch used here in purpose
        modifier = ModifierParser.parse(rawModifier);
    } else {
        modifier = rawModifier;
    }
    return modifier;
};

describe('ModifierValidator', () => {
    describe('exists', () => {
        describe('modifier as string type', () => {
            const existentModifiers = [
                'app',
                'badfilter',
                'cname',
                'content',
                'cookie',
                'csp',
                'denyallow',
                'document',
                'domain',
                'elemhide',
                'first-party',
                'extension',
                'font',
                'genericblock',
                'generichide',
                'header',
                'hls',
                'image',
                'important',
                'inline-font',
                'inline-script',
                'jsinject',
                'jsonprune',
                'match-case',
                'media',
                'method',
                'network',
                'object',
                'other',
                'permissions',
                'ping',
                'popup',
                'redirect-rule',
                'redirect',
                'referrerpolicy',
                'rewrite',
                'removeheader',
                'removeparam',
                'replace',
                'script',
                'specifichide',
                'stealth',
                'stylesheet',
                'subdocument',
                'third-party',
                'to',
                'urlblock',
                'websocket',
                'xmlhttprequest',
                // not supported by Adg and Ubo but supported by Abp
                'webrtc',
                // noop
                '_',
                // aliases are supported
                '3p',
                'ghide',
                'from',
                'frame',
                // negated modifiers are supported
                '~third-party',
                // not supported by Adg but supported by Ubo
                'popunder',
                'strict1p',
                'strict3p',
                // deprecated modifiers are existent as well (because they are supported)
                // and should be skipped during validation
                'empty',
                'mp4',
                // removed modifiers are not supported but they exist
                // and should be skipped during the validation
                'object-subrequest',
            ];
            test.each(existentModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                expect(modifierValidator.exists(modifier)).toBeTruthy();
            });

            const unsupportedModifiers = [
                'invalid',
                'protobuf',
                // few modifiers are not supported
                'third-party,important',
            ];
            test.each(unsupportedModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                expect(modifierValidator.exists(modifier)).toBeFalsy();
            });
        });

        describe('modifier as Modifier type', () => {
            // 'loc' properties is skipped as not required for this test
            const supportedModifiers = [
                // app=com.test.app
                {
                    type: 'Modifier',
                    name: {
                        type: 'Value',
                        value: 'app',
                    },
                    value: {
                        type: 'Value',
                        value: 'com.test.app',
                    },
                    exception: false,
                },
                // ~third-party
                {
                    type: 'Modifier',
                    name: {
                        type: 'Value',
                        value: 'third-party',
                    },
                    exception: true,
                },
            ];
            test.each(supportedModifiers)('%s', (modifierName) => {
                expect(modifierValidator.exists(modifierName as Modifier)).toBeTruthy();
            });

            const unsupportedModifiers = [
                {
                    type: 'Modifier',
                    name: {
                        type: 'Value',
                        value: 'protobuf',
                    },
                    exception: false,
                },
            ];
            test.each(unsupportedModifiers)('$modifier.value', (modifierName) => {
                expect(modifierValidator.exists(modifierName as Modifier)).toBeFalsy();
            });
        });
    });

    describe('validate for AdGuard', () => {
        describe('fully supported', () => {
            const supportedModifiers = [
                'all',
                'app=com.test.app',
                '~third-party',
                'badfilter',
                // valid noop modifiers may be used like this:
                '____',
            ];
            test.each(supportedModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                expect(validationResult.valid).toBeTruthy();
            });
        });

        describe('deprecated but still supported', () => {
            const supportedModifiers = [
                'empty',
                'mp4',
            ];
            test.each(supportedModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                expect(validationResult.valid).toBeTruthy();
                expect(validationResult.error).toBeUndefined();
                expect(validationResult.warn?.includes('support shall be removed in the future')).toBeTruthy();
            });
        });

        describe('invalid', () => {
            const unsupportedModifiersCases = [
                {
                    actual: 'not-existent',
                    expected: VALIDATION_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'protobuf',
                    expected: VALIDATION_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'popunder',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'object-subrequest',
                    expected: VALIDATION_ERROR_PREFIX.REMOVED,
                },
                {
                    actual: 'webrtc',
                    expected: VALIDATION_ERROR_PREFIX.REMOVED,
                },
                {
                    actual: '~popup',
                    expected: VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER,
                },
                {
                    actual: '~domain=example.com',
                    expected: VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER,
                },
                {
                    actual: '~app',
                    expected: VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER,
                },
                {
                    actual: 'domain',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'denyallow',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'network=8.8.8.8',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_FORBIDDEN,
                },
                {
                    actual: 'third-party=true',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_FORBIDDEN,
                },
                {
                    actual: '__noop__',
                    expected: VALIDATION_ERROR_PREFIX.INVALID_NOOP,
                },
            ];
            test.each(unsupportedModifiersCases)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                expect(validationResult.valid).toBeFalsy();
                expect(validationResult.error?.startsWith(expected)).toBeTruthy();
            });
        });

        describe('only for blocking rules', () => {
            // allowed only for exception rules
            const invalidForBlockingRuleModifiers = [
                'content',
                'extension',
                'elemhide',
                'genericblock',
                'generichide',
                'jsinject',
                'specifichide',
                'stealth',
                'urlblock',
            ];
            test.each(invalidForBlockingRuleModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // third argument is 'false' for blocking rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, false);
                expect(validationResult.valid).toBeFalsy();
                expect(validationResult.error?.startsWith(VALIDATION_ERROR_PREFIX.EXCEPTION_ONLY)).toBeTruthy();
            });

            const validForBlockingModifiers = [
                'important',
                'script',
                'image',
                // no problem with 'all' modifier for blocking rules
                'all',
            ];
            test.each(validForBlockingModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // third argument is 'false' for blocking rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, false);
                expect(validationResult.valid).toBeTruthy();
            });
        });

        describe('only for exception rules', () => {
            const invalidForExceptionRuleModifiers = [
                {
                    actual: 'all',
                    expected: VALIDATION_ERROR_PREFIX.BLOCK_ONLY,
                },
            ];
            test.each(invalidForExceptionRuleModifiers)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                // third argument is 'true' for exception rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, true);
                expect(validationResult.valid).toBeFalsy();
                expect(validationResult.error?.startsWith(expected)).toBeTruthy();
            });

            const validForExceptionRuleModifiers = [
                'important',
                'jsinject',
                'stealth',
            ];
            test.each(validForExceptionRuleModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // third argument is 'true' for exception rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, true);
                expect(validationResult.valid).toBeTruthy();
            });
        });

        describe('value validation', () => {
            describe('optional value', () => {
                const validModifiers = [
                    'cookie',
                    'csp',
                    'hls',
                    'jsonprune',
                    'redirect',
                    'redirect-rule',
                    'removeheader',
                    'removeparam',
                ];
                test.each(validModifiers)('%s', (rawModifier) => {
                    const modifier = getModifier(rawModifier);
                    const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                    expect(validationResult.valid).toBeTruthy();
                });
            });

            describe('required value - validate by regular expression', () => {
                describe('regexp valid', () => {
                    test.each([
                        'cookie=ABC',
                        'cookie=/zmFQeXtI|JPIqApiY/',
                        'csp=style-src *',
                        "csp=worker-src 'none'",
                        "csp=script-src 'self' * 'unsafe-inline'",
                        "csp=script-src 'self' 'unsafe-inline' http: https: blob:",
                        "csp=script-src 'self' * 'sha256-0McqMM66/wAVZmxF6zXpjNsb1UMbTl4LXBXdhqPKxws='",
                        'header=set-cookie',
                        'header=set-cookie:foo',
                        'header=set-cookie:/foo\\, bar\\$/',
                        'hls=\\/video^?*&source=video_ads',
                        'hls=/\\/video\\/?\\?.*\\&source=video_ads/i',
                        'hls=/#UPLYNK-SEGMENT:.*\\,ad/t',
                        'jsonprune=\\$..[one\\, "two three"]',
                        'jsonprune=\\$.a[?(has ad_origin)]',
                        "jsonprune=\\$.*.*[?(key-eq 'Some key' 'Some value')]",
                        'jsonprune=\\$.elements[?(has "\\$.a.b.c")]',
                        'jsonprune=\\$.elements[?(key-eq "\\$.a.b.c" "abc")]',
                        'redirect=noopjs',
                        'redirect=noopmp4-1s',
                        'redirect=googletagmanager-gtm',
                        'redirect-rule=noopjs',
                        'redirect-rule=noopmp4-1s',
                        'removeheader=link',
                        'removeheader=request:user-agent',
                        'removeparam=cb',
                        'removeparam=~red',
                        'removeparam=/^__s=[A-Za-z0-9]{6\\,}/',
                        'replace=/("ad":{).+"(\\}\\,"(?:log|watermark)")/\\$1\\$2/',
                        'replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/\\$1<\\/VAST>/',
                        'replace=/\\,this\\.createAdDisplayContainer\\(\\)\\,this\\.setUpIMA\\(\\)//',
                        'replace=/fourthColumnWrapper//',
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });
            });

            describe('required value - validate by pipe_separated_domains', () => {
                describe('pipe_separated_domains valid', () => {
                    test.each([
                        'domain=example.com',
                        'domain=~example.com',
                        'domain=example.com|example.org',
                        'domain=example.com|example.org|test-example.*',
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });

                describe('pipe_separated_domains invalid', () => {
                    test.each([
                        {
                            actual: 'domain=|example.com|example.org',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                        },
                        {
                            actual: 'domain=example.com||example.org',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'domain=example.com| |example.org',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'domain=example.com|example.org|',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                        },
                        {
                            actual: 'domain=~~example.com',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION,
                        },
                        {
                            actual: 'domain=example.org|~|example.com',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                        },
                        {
                            actual: 'domain=~ example.com',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                        },
                        {
                            actual: 'domain=example.com|example..org',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'domain': 'example..org'`,
                        },
                        {
                            actual: 'domain=exam[le.org|example.com|example,org|example or',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'domain': 'exam[le.org', 'example,org', 'example or'`,
                        },
                    ])('$actual', ({ actual, expected }) => {
                        const modifier = getModifier(actual);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error?.startsWith(expected)).toBeTruthy();
                    });
                });
            });

            describe('required value - validate by pipe_separated_denyallow_domains', () => {
                describe('pipe_separated_denyallow_domains valid', () => {
                    test.each([
                        'denyallow=example.com',
                        'denyallow=example.com|example.org',
                        'denyallow=example.com|example.org|test-example.com',
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });

                describe('pipe_separated_denyallow_domains invalid', () => {
                    test.each([
                        {
                            actual: 'denyallow=|example.com|example.org',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                        },
                        {
                            actual: 'denyallow=example.com||example.org',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'denyallow=example.com| |example.org',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'denyallow=example.com|example.org|',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                        },
                        {
                            actual: 'denyallow=~~example.com',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION,
                        },
                        {
                            actual: 'denyallow=example.org|~|example.com',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                        },
                        {
                            actual: 'denyallow=~ example.com',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                        },
                        {
                            actual: 'denyallow=example.com|example..org',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'denyallow': 'example..org'`,
                        },
                        {
                            actual: 'denyallow=exam[le.org|example.com|example,org|example or',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'denyallow': 'exam[le.org', 'example,org', 'example or'`,
                        },
                        // due to $denyallow restrictions: no wildcard tld, no negation
                        {
                            actual: 'denyallow=example.*',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'denyallow': 'example.*'`,
                        },
                        {
                            actual: 'denyallow=example.org|test-example.*',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'denyallow': 'test-example.*'`,
                        },
                        {
                            actual: 'denyallow=~example.com',
                            expected: `${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_VALUE}: 'denyallow': 'example.com'`,
                        },
                        {
                            actual: 'denyallow=example.com|~example.org',
                            expected: `${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_VALUE}: 'denyallow': 'example.org'`,
                        },
                    ])('$actual', ({ actual, expected }) => {
                        const modifier = getModifier(actual);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error?.startsWith(expected)).toBeTruthy();
                    });
                });
            });

            describe('required value - validate by pipe_separated_apps', () => {
                describe('pipe_separated_apps valid', () => {
                    test.each([
                        'app=Example.exe',
                        'app=Example2.exe',
                        'app=com.test_example.app',
                        'app=~com.test_example.app',
                        'app=Example.exe|com.example.app',
                        'app=Example.exe|~com.example.app|com.example.osx',
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });

                describe('pipe_separated_apps invalid', () => {
                    test.each([
                        {
                            actual: 'app=|Example.exe|com.example.app',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                        },
                        {
                            actual: 'app=Example.exe||com.example.app',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'app=Example.exe| |com.example.app',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'app=Example.exe|com.example.app|',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                        },
                        {
                            actual: 'app=~~Example.exe',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION,
                        },
                        {
                            actual: 'app=Example.exe|~|com.example.app',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                        },
                        {
                            actual: 'app=~ Example.exe',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                        },
                        {
                            actual: 'app=Example.exe|com.example..app',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'app': 'com.example..app'`,
                        },
                        {
                            actual: 'app=Exam[le.exe|com.example.app|Example,exe|Example exe',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'app': 'Exam[le.exe', 'Example,exe', 'Example exe'`,
                        },
                        // due to $app restrictions: no wildcard tld
                        {
                            actual: 'app=Example.*',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'app': 'Example.*'`,
                        },
                        {
                            actual: 'app=Example.exe|com.example.*',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'app': 'com.example.*'`,
                        },
                    ])('$actual', ({ actual, expected }) => {
                        const modifier = getModifier(actual);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error?.startsWith(expected)).toBeTruthy();
                    });
                });
            });

            describe('required value - validate by pipe_separated_methods', () => {
                describe('pipe_separated_methods valid', () => {
                    test.each([
                        'method=get',
                        'method=~head',
                        'method=post|put',
                        'method=get|post|put',
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });

                describe('pipe_separated_methods invalid', () => {
                    test.each([
                        {
                            actual: 'method=|get|post',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                        },
                        {
                            actual: 'method=get||post',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'method=get| |post',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'method=get|post|',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                        },
                        {
                            actual: 'method=~~get',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION,
                        },
                        {
                            actual: 'method=get|~|put',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                        },
                        {
                            actual: 'method=~ get',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                        },
                        {
                            actual: 'method=get|connect|disconnect',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'method': 'disconnect'`,
                        },
                        {
                            // despite the method is matched case-insensitively, the value should be lowercased
                            actual: 'method=GET',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'method': 'GET'`,
                        },
                        // due to $method restrictions: no mixed negated and not negated values
                        {
                            actual: 'method=get|~post',
                            expected: `${VALIDATION_ERROR_PREFIX.MIXED_NEGATIONS}: 'method': 'post'`,
                        },
                        {
                            actual: 'method=~get|post|put',
                            expected: `${VALIDATION_ERROR_PREFIX.MIXED_NEGATIONS}: 'method': 'post', 'put'`,
                        },
                    ])('$actual', ({ actual, expected }) => {
                        const modifier = getModifier(actual);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error?.startsWith(expected)).toBeTruthy();
                    });
                });
            });

            describe('required value - validate by pipe_separated_stealth_options', () => {
                describe('pipe_separated_stealth_options valid', () => {
                    test.each([
                        'stealth',
                        'stealth=searchqueries',
                        'stealth=donottrack|3p-cookie|1p-cookie|3p-cache|3p-auth',
                        'stealth=webrtc|push|location|flash|java|referrer',
                        'stealth=useragent|ip|xclientdata|dpi',
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, true);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });

                describe('pipe_separated_stealth_options invalid', () => {
                    test.each([
                        {
                            actual: 'stealth=|donottrack|ip',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                        },
                        {
                            actual: 'stealth=ip||useragent',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'stealth=ip| |useragent',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'stealth=useragent|dpi|',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                        },
                        {
                            actual: 'stealth=~~searchqueries',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION,
                        },
                        {
                            actual: 'stealth=useragent|~|dpi',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                        },
                        {
                            actual: 'stealth=~ dpi',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                        },
                        {
                            actual: 'stealth=3p-auth|mp3',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'stealth': 'mp3'`,
                        },
                        // due to $stealth restrictions: values should be lowercased, no negate values
                        {
                            actual: 'stealth=PUSH',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'stealth': 'PUSH'`,
                        },
                        {
                            actual: 'stealth=~ip',
                            expected: `${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_VALUE}: 'stealth': 'ip'`,
                        },
                        {
                            actual: 'stealth=~searchqueries|dpi',
                            expected: `${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_VALUE}: 'stealth': 'searchqueries'`,
                        },
                    ])('$actual', ({ actual, expected }) => {
                        const modifier = getModifier(actual);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, true);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error).toEqual(expected);
                    });
                });
            });

            describe('required value - validate by csp_value', () => {
                describe('csp_value valid', () => {
                    test.each([
                        'csp',
                        'csp=child-src *',
                        'csp=sandbox allow-same-origin;',
                        "csp=script-src 'self' '*' 'unsafe-inline' *.example.com *.example.org",
                        "csp=script-src 'self' 'unsafe-inline' https://example.com *.example.com",
                        "csp=default-src 'self' *.example.com fonts.example.org https://the-example.com https://the.example.com 'unsafe-inline' 'unsafe-eval' data: blob:",
                        "csp=script-src 'self' * 'sha256-0McqMM16/wAVZmxF6zXpjNsb1UM6Tl4LXBxdhqPKxws='",
                        // few directives
                        "csp=child-src 'none'; frame-src 'self' *; worker-src 'none'",
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, true);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });

                describe('csp_value invalid', () => {
                    test.each([
                        {
                            actual: 'csp= ;',
                            // no space in error message
                            // because modifier value is trimmed during parsing into Modifier AST node
                            expected: `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: 'csp': ";"`,
                        },
                        {
                            actual: 'csp=none',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_CSP_DIRECTIVES}: 'csp': "none"`,
                        },
                        {
                            actual: 'csp=default',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_CSP_DIRECTIVES}: 'csp': "default"`,
                        },
                        {
                            actual: "csp='child-src' 'none'",
                            expected: `${VALIDATION_ERROR_PREFIX.NO_CSP_DIRECTIVE_QUOTE}: 'csp': 'child-src'`,
                        },
                        {
                            actual: "csp=child-src 'none'; frame src 'self' *; workers 'none'",
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_CSP_DIRECTIVES}: 'csp': "frame", "workers"`,
                        },
                        {
                            actual: "csp=child-src 'none'; ; worker-src 'none'",
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: 'csp': "child-src 'none'; ; worker-src 'none'"`,
                        },
                        {
                            actual: 'csp=script-src',
                            expected: `${VALIDATION_ERROR_PREFIX.NO_CSP_VALUE}: 'csp': 'script-src'`,
                        },
                        {
                            actual: "csp=child-src 'none'; frame-src; worker-src 'none'",
                            expected: `${VALIDATION_ERROR_PREFIX.NO_CSP_VALUE}: 'csp': 'frame-src'`,
                        },
                    ])('$actual', ({ actual, expected }) => {
                        const modifier = getModifier(actual);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error).toEqual(expected);
                    });
                });
            });

            describe('required value - validate by permissions_value', () => {
                describe('permissions_value valid', () => {
                    test.each([
                        'permissions',
                        'permissions=fullscreen=*',
                        'permissions=autoplay=()',
                        'permissions=geolocation=(self)',
                        'permissions=geolocation=(self "https://example.com")',
                        'permissions=geolocation=("https://example.com" "https://*.example.com")',
                        'permissions=geolocation=("https://example.com"  "https://*.example.com")',
                        // multiple permissions
                        'permissions=storage-access=()\\, camera=()',
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, true);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });

                describe('permissions_value invalid', () => {
                    test.each([
                        {
                            actual: 'permissions=wi-fi=()',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_DIRECTIVE}: 'permissions': 'wi-fi'`,
                        },
                        {
                            actual: 'permissions=autoplay=self',
                            expected: `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: 'permissions'`,
                        },
                        {
                            actual: 'permissions=autoplay=none',
                            expected: `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: 'permissions'`,
                        },
                        // quotes are checked first
                        {
                            actual: "permissions=autoplay=('*')",
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'autoplay': '*'`,
                        },
                        // so after quotes are corrected, the origin is being validated
                        {
                            actual: 'permissions=autoplay=("*")',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGINS}: 'permissions': 'autoplay': '*'`,
                        },
                        {
                            actual: 'permissions=autoplay=(',
                            expected: `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: 'permissions'`,
                        },
                        {
                            actual: 'permissions=autoplay=)',
                            expected: `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: 'permissions'`,
                        },
                        {
                            actual: 'permissions=autoplay=())',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'autoplay': ')'`,
                        },
                        {
                            actual: 'permissions=autoplay=(() "https://example.com")',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'autoplay': '()'`,
                        },
                        {
                            actual: 'permissions=autoplay=(* "https://example.com")',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'autoplay': '*'`,
                        },
                        {
                            actual: 'permissions=autoplay=(* self)',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'autoplay': '*'`,
                        },
                        {
                            actual: 'permissions=autoplay=(hello "https://example.com")',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'autoplay': 'hello'`,
                        },
                        {
                            actual: 'permissions=autoplay=("hello" "https://example.com")',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGINS}: 'permissions': 'autoplay': 'hello'`,
                        },
                        {
                            actual: 'permissions=autoplay=("hello" "world")',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGINS}: 'permissions': 'autoplay': 'hello', 'world'`,
                        },
                        {
                            actual: 'permissions=geolocation=(https://example.com https://*.example.com)',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'geolocation': 'https://example.com'`,
                        },
                        {
                            actual: "permissions=geolocation=('https://example.com' 'https://*.example.com')",
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'geolocation': 'https://example.com'`,
                        },
                        {
                            actual: "permissions=autoplay=()\\, geolocation=('self')",
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'geolocation': 'self'`,
                        },
                        {
                            actual: 'permissions=autoplay=(() self))',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: 'permissions': 'autoplay': '()'`,
                        },
                        {
                            actual: 'permissions=autoplay=("()" self)',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGINS}: 'permissions': 'autoplay': '()'`,
                        },
                        {
                            actual: 'permissions=geolocation=("https://example.com", "https://*.example.com")',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.NO_UNESCAPED_PERMISSION_COMMA}: 'permissions': 'geolocation=("https://example.com", "https://*.example.com")'`,
                        },
                        {
                            actual: 'permissions=storage-access=()\\, \\, camera=()',
                            expected: `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: 'permissions'`,
                        },
                        // TODO: implement later
                        // {
                        //     actual: 'permissions',
                        //     expected: VALIDATION_ERROR_PREFIX.NO_VALUE_ONLY_FOR_EXCEPTION,
                        // },
                    ])('$actual', ({ actual, expected }) => {
                        const modifier = getModifier(actual);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error).toEqual(expected);
                    });
                });
            });

            describe('required value - validate by referrerpolicy_value', () => {
                describe('referrerpolicy_value valid', () => {
                    test.each([
                        'referrerpolicy=no-referrer',
                        'referrerpolicy=no-referrer-when-downgrade',
                        'referrerpolicy=origin',
                        'referrerpolicy=origin-when-cross-origin',
                        'referrerpolicy=same-origin',
                        'referrerpolicy=strict-origin',
                        'referrerpolicy=strict-origin-when-cross-origin',
                        'referrerpolicy=unsafe-url',
                        // value may be empty in unblocking rules
                        'referrerpolicy',
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, true);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });

                describe('referrerpolicy_value invalid', () => {
                    test.each([
                        {
                            actual: 'referrerpolicy=autoplay=self',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_REFERRER_POLICY_DIRECTIVE}: 'referrerpolicy': 'autoplay=self'`,
                        },
                        {
                            actual: 'referrerpolicy=no-origin',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_REFERRER_POLICY_DIRECTIVE}: 'referrerpolicy': 'no-origin'`,
                        },
                        {
                            // non-latin "o" in "origin"
                            actual: 'referrerpolicy=оrigin',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_REFERRER_POLICY_DIRECTIVE}: 'referrerpolicy': 'оrigin'`,
                        },
                        {
                            actual: '~referrerpolicy=same-origin',
                            expected: `${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER}: 'referrerpolicy'`,
                        },
                    ])('$actual', ({ actual, expected }) => {
                        const modifier = getModifier(actual);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error).toEqual(expected);
                    });
                });
            });
        });
    });

    describe('validate for UblockOrigin', () => {
        describe('valid', () => {
            const supportedModifiers = [
                'all',
                '~third-party',
                'badfilter',
                'popunder',
                '____',
            ];
            test.each(supportedModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier);
                expect(validationResult.valid).toBeTruthy();
            });
        });

        describe('invalid', () => {
            const unsupportedModifiersCases = [
                {
                    actual: 'not-existent',
                    expected: VALIDATION_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'protobuf',
                    expected: VALIDATION_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'webrtc',
                    expected: VALIDATION_ERROR_PREFIX.REMOVED,
                },
                {
                    actual: 'genericblock',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'object-subrequest',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'app=com.test.app',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'jsinject',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: '~popup',
                    expected: VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER,
                },
                {
                    actual: '~domain=example.com',
                    expected: VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER,
                },
                {
                    actual: 'domain',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'denyallow',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'third-party=true',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_FORBIDDEN,
                },
                {
                    actual: '__-__',
                    expected: VALIDATION_ERROR_PREFIX.INVALID_NOOP,
                },
            ];
            test.each(unsupportedModifiersCases)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier);
                expect(validationResult.valid).toBeFalsy();
                expect(validationResult.error?.startsWith(expected)).toBeTruthy();
            });
        });

        describe('only for blocking rules', () => {
            const invalidForBlockingRuleModifiers = [
                'cname',
                'ehide',
                'generichide',
                'specifichide',
            ];
            test.each(invalidForBlockingRuleModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // third argument is 'false' for blocking rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier, false);
                expect(validationResult.valid).toBeFalsy();
                expect(validationResult.error?.startsWith(VALIDATION_ERROR_PREFIX.EXCEPTION_ONLY)).toBeTruthy();
            });

            const validForBlockingRuleModifiers = [
                // no problem with 'popunder' modifier for blocking rules
                'popunder',
            ];
            test.each(validForBlockingRuleModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // third argument is 'false' for blocking rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier, false);
                expect(validationResult.valid).toBeTruthy();
            });
        });

        describe('only for exception rules', () => {
            const invalidForExceptionRuleModifiers = [
                {
                    actual: 'popunder',
                    expected: VALIDATION_ERROR_PREFIX.BLOCK_ONLY,
                },
            ];
            test.each(invalidForExceptionRuleModifiers)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                // third argument is 'true' for exception rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier, true);
                expect(validationResult.valid).toBeFalsy();
                expect(validationResult.error?.startsWith(expected)).toBeTruthy();
            });

            const validForExceptionRuleModifiers = [
                'important',
                'elemhide',
            ];
            test.each(validForExceptionRuleModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // third argument is 'true' for exception rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier, true);
                expect(validationResult.valid).toBeTruthy();
            });
        });

        describe('value validation', () => {
            describe('required value - validate by pipe_separated_domains', () => {
                describe('pipe_separated_domains valid', () => {
                    test.each([
                        'to=example.com',
                        'to=~example.com',
                        'to=example.com|example.org',
                        'to=example.com|example.org|test-example.*',
                    ])('%s', (rawModifier) => {
                        const modifier = getModifier(rawModifier);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier);
                        expect(validationResult.valid).toBeTruthy();
                    });
                });

                describe('pipe_separated_domains invalid', () => {
                    test.each([
                        {
                            actual: 'domain=|example.com|example.org',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                        },
                        {
                            actual: 'domain=example.com||example.org',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'domain=example.com| |example.org',
                            expected: LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                        },
                        {
                            actual: 'domain=example.com|example.org|',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                        },
                        {
                            actual: 'domain=~~example.com',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION,
                        },
                        {
                            actual: 'domain=example.org|~|example.com',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                        },
                        {
                            actual: 'domain=~ example.com',
                            expected: LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                        },
                        {
                            actual: 'domain=example.com|example..org',
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'domain': 'example..org'`,
                        },
                        {
                            actual: 'domain=exam[le.org|example.com|example,org|example or',
                            // eslint-disable-next-line max-len
                            expected: `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: 'domain': 'exam[le.org', 'example,org', 'example or'`,
                        },
                    ])('$actual', ({ actual, expected }) => {
                        const modifier = getModifier(actual);
                        const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error?.startsWith(expected)).toBeTruthy();
                    });
                });
            });
        });
    });

    describe('validate for AdblockPlus', () => {
        describe('valid', () => {
            const supportedModifiers = [
                'domain=example.com',
                'third-party',
                // 'webrtc' is fully supported by ABP, not deprecated
                'webrtc',
                'rewrite=abp-resource:blank-js',
            ];
            test.each(supportedModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const validationResult = modifierValidator.validate(AdblockSyntax.Abp, modifier);
                expect(validationResult.valid).toBeTruthy();
            });
        });

        describe('invalid', () => {
            const unsupportedModifiersCases = [
                {
                    actual: 'not-existent',
                    expected: VALIDATION_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'protobuf',
                    expected: VALIDATION_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'object-subrequest',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'app=com.test.app',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'jsinject',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'denyallow',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: '~popup',
                    expected: VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER,
                },
                {
                    actual: '~domain=example.com',
                    expected: VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER,
                },
                {
                    actual: 'domain',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'third-party=true',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_FORBIDDEN,
                },
                {
                    actual: '___',
                    expected: VALIDATION_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'rewrite',
                    expected: VALIDATION_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: '~rewrite=abp-resource:blank-js',
                    expected: VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER,
                },
                // TODO: Validate value format
                // {
                //     actual: 'rewrite=abp-resource:protobuf',
                //     expected: INVALID_ERROR_PREFIX.VALUE_FORBIDDEN,
                // },
            ];
            test.each(unsupportedModifiersCases)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                const validationResult = modifierValidator.validate(AdblockSyntax.Abp, modifier);
                expect(validationResult.valid).toBeFalsy();
                expect(validationResult.error?.startsWith(expected)).toBeTruthy();
            });
        });

        describe('only for blocking rules', () => {
            const invalidForBlockingRuleModifiers = [
                'elemhide',
                'genericblock',
                'generichide',
            ];
            test.each(invalidForBlockingRuleModifiers)('%s', (rawModifier) => {
                const EXPECTED_ERROR = 'Only exception rules may contain the modifier';
                const modifier = getModifier(rawModifier);
                // third argument is 'false' for blocking rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Abp, modifier, false);
                expect(validationResult.valid).toBeFalsy();
                expect(validationResult.error?.startsWith(EXPECTED_ERROR)).toBeTruthy();
            });

            const validForBlockingRuleModifiers = [
                // no problem with 'media' modifier for blocking rules
                'media',
            ];
            test.each(validForBlockingRuleModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // third argument is 'false' for blocking rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Abp, modifier, false);
                expect(validationResult.valid).toBeTruthy();
            });
        });
    });

    describe('getAdgDocumentationLink', () => {
        describe('has docs', () => {
            const modifiers = [
                'denyallow',
                'domain=example.com',
                'third-party',
                'important',
                // deprecated
                'empty',
                'mp4',
                // 'webrtc' is removed and not supported but it has docs url
                'webrtc',
            ];
            test.each(modifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const docsUrl = modifierValidator.getAdgDocumentationLink(modifier);
                expect(docsUrl?.startsWith(DOCS_BASE_URL.ADG)).toBeTruthy();
            });
        });

        describe('no docs', () => {
            const modifiers = [
                // not existent
                'protobuf',
                // not supported by ADG
                'cname',
            ];
            test.each(modifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const docsUrl = modifierValidator.getAdgDocumentationLink(modifier);
                expect(docsUrl).toBeNull();
            });
        });
    });

    describe('getUboDocumentationLink', () => {
        describe('has docs', () => {
            const modifiers = [
                'cname',
                'from=example.com',
                'third-party',
                'important',
                // deprecated modifiers
                'empty',
                'mp4',
                // 'webrtc' is removed and not supported but it has docs url
                'webrtc',
            ];
            test.each(modifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const docsUrl = modifierValidator.getUboDocumentationLink(modifier);
                expect(docsUrl?.startsWith(DOCS_BASE_URL.UBO)).toBeTruthy();
            });
        });

        describe('no docs', () => {
            const modifiers = [
                // not existent
                'protobuf',
                // not supported by UBO
                'removeheader',
            ];
            test.each(modifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const docsUrl = modifierValidator.getUboDocumentationLink(modifier);
                expect(docsUrl).toBeNull();
            });
        });
    });

    describe('getAbpDocumentationLink', () => {
        describe('has docs', () => {
            const modifiers = [
                'domain=example.com',
                'third-party',
                'webrtc',
            ];
            test.each(modifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const docsUrl = modifierValidator.getAbpDocumentationLink(modifier);
                expect(docsUrl?.startsWith(DOCS_BASE_URL.ABP)).toBeTruthy();
            });
        });

        describe('no docs', () => {
            const modifiers = [
                // not existent
                'protobuf',
                // not supported by ABP
                'denyallow',
                'important',
            ];
            test.each(modifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const docsUrl = modifierValidator.getAbpDocumentationLink(modifier);
                expect(docsUrl).toBeNull();
            });
        });
    });
});
