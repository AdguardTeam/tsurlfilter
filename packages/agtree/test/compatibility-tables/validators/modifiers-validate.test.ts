/**
 * @file Tests for modifiers value validation via modifiersCompatibilityTable.validate().
 *
 * These tests call the compatibility table's validate method directly with a ValidationContext,
 * testing the structured output (messageId, data) rather than formatted error strings.
 */

import { describe, expect, test } from 'vitest';

import { modifiersCompatibilityTable } from '../../../src/compatibility-tables/modifiers';
import { Platform } from '../../../src/compatibility-tables';
import { ValidationContext } from '../../../src/compatibility-tables/validators/validation-context';

/**
 * Helper: validate a modifier string and return the context.
 *
 * @param raw Raw modifier string, e.g. 'domain=example.com'.
 * @param platform Platform to validate against.
 * @param isExceptionRule Whether the rule is an exception rule.
 *
 * @returns The validation context after validation.
 */
const validateModifier = (
    raw: string,
    platform: Platform = Platform.AdgOsWindows,
    isExceptionRule?: boolean,
): ValidationContext => {
    const ctx = new ValidationContext();
    modifiersCompatibilityTable.validate(raw, ctx, platform, isExceptionRule);
    return ctx;
};

describe('ModifiersCompatibilityTable.validate — value validation', () => {
    describe('optional value modifiers', () => {
        test.each([
            'cookie',
            'csp',
            'hls',
            'jsonprune',
            'redirect',
            'redirect-rule',
            'removeheader',
            'removeparam',
        ])('%s without value is valid', (raw) => {
            const ctx = validateModifier(raw);
            expect(ctx.valid).toBe(true);
        });
    });

    describe('regexp-based value validation', () => {
        test.each([
            'cookie=ABC',
            'cookie=/zmFQeXtI|JPIqApiY/',
            "csp=script-src 'self' * 'unsafe-inline'",
            'header=set-cookie',
            'header=set-cookie:foo',
            'header=set-cookie:/foo\\, bar\\$/',
            'hls=\\/video^?*&source=video_ads',
            'jsonprune=\\$..[one\\, "two three"]',
            'redirect=noopjs',
            'redirect-rule=noopmp4-1s',
            'removeheader=link',
            'removeheader=request:user-agent',
            'removeparam=cb',
            'removeparam=~red',
            'removeparam=/^__s=[A-Za-z0-9]{6\\,}/',
            'replace=/("ad":{).+"(\\}\\,"(?:log|watermark)")/\\$1\\$2/',
        ])('%s is valid', (raw) => {
            const ctx = validateModifier(raw);
            expect(ctx.valid).toBe(true);
        });
    });

    describe('pipe_separated_domains', () => {
        describe('valid', () => {
            test.each([
                'domain=example.com',
                'domain=~example.com',
                'domain=example.com|example.org',
                'domain=example.com|example.org|test-example.*',
            ])('%s', (raw) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(true);
            });
        });

        describe('parse errors', () => {
            test.each([
                'domain=|example.com|example.org',
                'domain=example.com||example.org',
                'domain=example.com| |example.org',
                'domain=example.com|example.org|',
                'domain=~~example.com',
                'domain=example.org|~|example.com',
                'domain=~ example.com',
            ])('%s produces DOMAIN_LIST_PARSE_ERROR', (raw) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('DOMAIN_LIST_PARSE_ERROR');
                expect(ctx.issues?.[0]?.data?.message).toBeDefined();
            });
        });

        describe('invalid domain values', () => {
            test.each([
                {
                    raw: 'domain=example.com|example..org',
                    expectedValues: ['example..org'],
                },
                {
                    raw: 'domain=exam[le.org|example.com|example,org|example or',
                    expectedValues: ['exam[le.org', 'example,org', 'example or'],
                },
            ])('$raw', ({ raw, expectedValues }) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('INVALID_DOMAIN_LIST_VALUES');
                expect(ctx.issues?.[0]?.data?.values).toEqual(expectedValues);
            });
        });

        describe('UBO — pipe_separated_domains via $to', () => {
            test.each([
                'to=example.com',
                'to=~example.com',
                'to=example.com|example.org',
                'to=example.com|example.org|test-example.*',
            ])('%s is valid', (raw) => {
                const ctx = validateModifier(raw, Platform.UboExtFirefox);
                expect(ctx.valid).toBe(true);
            });

            test.each([
                'domain=|example.com|example.org',
                'domain=example.com||example.org',
                'domain=example.com| |example.org',
                'domain=example.com|example.org|',
                'domain=~~example.com',
                'domain=example.org|~|example.com',
                'domain=~ example.com',
            ])('%s produces DOMAIN_LIST_PARSE_ERROR for UBO', (raw) => {
                const ctx = validateModifier(raw, Platform.UboExtFirefox);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('DOMAIN_LIST_PARSE_ERROR');
            });

            test.each([
                {
                    raw: 'domain=example.com|example..org',
                    expectedValues: ['example..org'],
                },
                {
                    raw: 'domain=exam[le.org|example.com|example,org|example or',
                    expectedValues: ['exam[le.org', 'example,org', 'example or'],
                },
            ])('$raw produces INVALID_DOMAIN_LIST_VALUES for UBO', ({ raw, expectedValues }) => {
                const ctx = validateModifier(raw, Platform.UboExtFirefox);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('INVALID_DOMAIN_LIST_VALUES');
                expect(ctx.issues?.[0]?.data?.values).toEqual(expectedValues);
            });
        });
    });

    describe('pipe_separated_denyallow_domains', () => {
        describe('valid', () => {
            test.each([
                'denyallow=example.com',
                'denyallow=example.com|example.org',
                'denyallow=example.com|example.org|test-example.com',
            ])('%s', (raw) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(true);
            });
        });

        describe('parse errors', () => {
            test.each([
                'denyallow=|example.com|example.org',
                'denyallow=example.com||example.org',
                'denyallow=example.com| |example.org',
                'denyallow=example.com|example.org|',
                'denyallow=~~example.com',
                'denyallow=example.org|~|example.com',
                'denyallow=~ example.com',
            ])('%s produces DOMAIN_LIST_PARSE_ERROR', (raw) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('DOMAIN_LIST_PARSE_ERROR');
            });
        });

        describe('invalid domain values', () => {
            test.each([
                {
                    raw: 'denyallow=example.com|example..org',
                    expectedValues: ['example..org'],
                },
                {
                    raw: 'denyallow=exam[le.org|example.com|example,org|example or',
                    expectedValues: ['exam[le.org', 'example,org', 'example or'],
                },
                // denyallow restriction: no wildcard tld
                {
                    raw: 'denyallow=example.*',
                    expectedValues: ['example.*'],
                },
                {
                    raw: 'denyallow=example.org|test-example.*',
                    expectedValues: ['test-example.*'],
                },
            ])('$raw produces INVALID_DOMAIN_LIST_VALUES', ({ raw, expectedValues }) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('INVALID_DOMAIN_LIST_VALUES');
                expect(ctx.issues?.[0]?.data?.values).toEqual(expectedValues);
            });
        });

        describe('negated values (forbidden for denyallow)', () => {
            test.each([
                {
                    raw: 'denyallow=~example.com',
                    expectedValues: ['example.com'],
                },
                {
                    raw: 'denyallow=example.com|~example.org',
                    expectedValues: ['example.org'],
                },
            ])('$raw produces NEGATED_DOMAIN_VALUES', ({ raw, expectedValues }) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('NEGATED_DOMAIN_VALUES');
                expect(ctx.issues?.[0]?.data?.values).toEqual(expectedValues);
            });
        });
    });

    describe('pipe_separated_apps', () => {
        describe('valid', () => {
            test.each([
                'app=Example.exe',
                'app=Example2.exe',
                'app=com.test_example.app',
                'app=~com.test_example.app',
                'app=Example.exe|com.example.app',
                'app=Example.exe|~com.example.app|com.example.osx',
            ])('%s', (raw) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(true);
            });
        });

        describe('parse errors', () => {
            test.each([
                'app=|Example.exe|com.example.app',
                'app=Example.exe||com.example.app',
                'app=Example.exe| |com.example.app',
                'app=Example.exe|com.example.app|',
                'app=~~Example.exe',
                'app=Example.exe|~|com.example.app',
                'app=~ Example.exe',
            ])('%s produces APP_LIST_PARSE_ERROR', (raw) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('APP_LIST_PARSE_ERROR');
            });
        });

        describe('invalid app values', () => {
            test.each([
                {
                    raw: 'app=Example.exe|com.example..app',
                    expectedValues: ['com.example..app'],
                },
                {
                    raw: 'app=Exam[le.exe|com.example.app|Example,exe|Example exe',
                    expectedValues: ['Exam[le.exe', 'Example,exe', 'Example exe'],
                },
                // app restriction: no wildcard tld
                {
                    raw: 'app=Example.*',
                    expectedValues: ['Example.*'],
                },
                {
                    raw: 'app=Example.exe|com.example.*',
                    expectedValues: ['com.example.*'],
                },
            ])('$raw produces INVALID_APP_LIST_VALUES', ({ raw, expectedValues }) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('INVALID_APP_LIST_VALUES');
                expect(ctx.issues?.[0]?.data?.values).toEqual(expectedValues);
            });
        });
    });

    describe('pipe_separated_methods', () => {
        describe('valid', () => {
            test.each([
                'method=get',
                'method=~head',
                'method=post|put',
                'method=get|post|put',
            ])('%s', (raw) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(true);
            });
        });

        describe('parse errors', () => {
            test.each([
                'method=|get|post',
                'method=get||post',
                'method=get| |post',
                'method=get|post|',
                'method=~~get',
                'method=get|~|put',
                'method=~ get',
            ])('%s produces METHOD_LIST_PARSE_ERROR', (raw) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('METHOD_LIST_PARSE_ERROR');
            });
        });

        describe('invalid method values', () => {
            test.each([
                {
                    raw: 'method=get|connect|disconnect',
                    expectedValues: ['disconnect'],
                },
                {
                    // despite the method is matched case-insensitively, the value should be lowercased
                    raw: 'method=GET',
                    expectedValues: ['GET'],
                },
            ])('$raw produces INVALID_METHOD_LIST_VALUES', ({ raw, expectedValues }) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('INVALID_METHOD_LIST_VALUES');
                expect(ctx.issues?.[0]?.data?.values).toEqual(expectedValues);
            });
        });

        describe('mixed negations (forbidden for method)', () => {
            test.each([
                {
                    raw: 'method=get|~post',
                    expectedValues: ['post'],
                },
                {
                    raw: 'method=~get|post|put',
                    expectedValues: ['post', 'put'],
                },
            ])('$raw produces MIXED_METHOD_NEGATIONS', ({ raw, expectedValues }) => {
                const ctx = validateModifier(raw);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('MIXED_METHOD_NEGATIONS');
                expect(ctx.issues?.[0]?.data?.values).toEqual(expectedValues);
            });
        });
    });

    describe('pipe_separated_stealth_options', () => {
        describe('valid', () => {
            test.each([
                'stealth=searchqueries',
                'stealth=donottrack|3p-cookie|1p-cookie|3p-cache|3p-auth',
                'stealth=webrtc|push|location|flash|java|referrer',
                'stealth=useragent|ip|xclientdata|dpi',
            ])('%s', (raw) => {
                // stealth is exception-only for AdGuard
                const ctx = validateModifier(raw, Platform.AdgOsWindows, true);
                expect(ctx.valid).toBe(true);
            });
        });

        describe('parse errors', () => {
            test.each([
                'stealth=|donottrack|ip',
                'stealth=ip||useragent',
                'stealth=ip| |useragent',
                'stealth=useragent|dpi|',
                'stealth=~~searchqueries',
                'stealth=useragent|~|dpi',
                'stealth=~ dpi',
            ])('%s produces STEALTH_OPTION_LIST_PARSE_ERROR', (raw) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows, true);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('STEALTH_OPTION_LIST_PARSE_ERROR');
            });
        });

        describe('invalid stealth option values', () => {
            test.each([
                {
                    raw: 'stealth=3p-auth|mp3',
                    expectedValues: ['mp3'],
                },
                {
                    // values should be lowercased
                    raw: 'stealth=PUSH',
                    expectedValues: ['PUSH'],
                },
            ])('$raw produces INVALID_STEALTH_OPTION_LIST_VALUES', ({ raw, expectedValues }) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows, true);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('INVALID_STEALTH_OPTION_LIST_VALUES');
                expect(ctx.issues?.[0]?.data?.values).toEqual(expectedValues);
            });
        });

        describe('negated values (forbidden for stealth)', () => {
            test.each([
                {
                    raw: 'stealth=~ip',
                    expectedValues: ['ip'],
                },
                {
                    raw: 'stealth=~searchqueries|dpi',
                    expectedValues: ['searchqueries'],
                },
            ])('$raw produces NEGATED_STEALTH_OPTION_VALUES', ({ raw, expectedValues }) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows, true);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('NEGATED_STEALTH_OPTION_VALUES');
                expect(ctx.issues?.[0]?.data?.values).toEqual(expectedValues);
            });
        });
    });

    describe('csp_value', () => {
        describe('valid', () => {
            test.each([
                'csp=child-src *',
                'csp=sandbox allow-same-origin;',
                "csp=script-src 'self' '*' 'unsafe-inline' *.example.com *.example.org",
                "csp=script-src 'self' 'unsafe-inline' https://example.com *.example.com",
                // eslint-disable-next-line max-len
                "csp=default-src 'self' *.example.com fonts.example.org https://the-example.com https://the.example.com 'unsafe-inline' 'unsafe-eval' data: blob:",
                "csp=script-src 'self' * 'sha256-0McqMM16/wAVZmxF6zXpjNsb1UM6Tl4LXBxdhqPKxws='",
                "csp=child-src 'none'; frame-src 'self' *; worker-src 'none'",
                'csp=fenced-frame-src https://example.com/',
                'csp=referrer "none"',
                "csp=require-trusted-types-for 'script'",
                "csp=script-src-attr 'none'",
                'csp=script-src-elem https://example.com/',
                "csp=style-src-attr 'none'",
                'csp=style-src-elem https://example.com/',
                "csp=trusted-types foo bar 'allow-duplicates'",
            ])('%s', (raw) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows, true);
                expect(ctx.valid).toBe(true);
            });
        });

        describe('empty / no directives', () => {
            test('csp= ; produces EMPTY_CSP_DIRECTIVE or NO_CSP_DIRECTIVES', () => {
                // modifier value is trimmed during parsing, so value becomes ";"
                const ctx = validateModifier('csp= ;', Platform.AdgOsWindows);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('NO_CSP_DIRECTIVES');
            });

            test("csp=child-src 'none'; ; worker-src 'none' produces EMPTY_CSP_DIRECTIVE", () => {
                // eslint-disable-next-line max-len
                const ctx = validateModifier("csp=child-src 'none'; ; worker-src 'none'", Platform.AdgOsWindows);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('EMPTY_CSP_DIRECTIVE');
            });
        });

        describe('invalid CSP directives', () => {
            test.each([
                {
                    raw: 'csp=none',
                    expectedDirectives: ['none'],
                },
                {
                    raw: 'csp=default',
                    expectedDirectives: ['default'],
                },
                {
                    raw: "csp=child-src 'none'; frame src 'self' *; workers 'none'",
                    expectedDirectives: ['frame', 'workers'],
                },
            ])('$raw produces INVALID_CSP_DIRECTIVES', ({ raw, expectedDirectives }) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('INVALID_CSP_DIRECTIVES');
                expect(ctx.issues?.[0]?.data?.directives).toEqual(expectedDirectives);
            });
        });

        describe('quoted CSP directive', () => {
            test("csp='child-src' 'none' produces CSP_DIRECTIVE_QUOTED", () => {
                const ctx = validateModifier("csp='child-src' 'none'", Platform.AdgOsWindows);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('CSP_DIRECTIVE_QUOTED');
                expect(ctx.issues?.[0]?.data?.directive).toBe('child-src');
            });
        });

        describe('CSP directive without value', () => {
            test.each([
                {
                    raw: 'csp=script-src',
                    expectedDirective: 'script-src',
                },
                {
                    raw: "csp=child-src 'none'; frame-src; worker-src 'none'",
                    expectedDirective: 'frame-src',
                },
            ])('$raw produces CSP_DIRECTIVE_NO_VALUE', ({ raw, expectedDirective }) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('CSP_DIRECTIVE_NO_VALUE');
                expect(ctx.issues?.[0]?.data?.directive).toBe(expectedDirective);
            });
        });
    });

    describe('permissions_value', () => {
        describe('valid', () => {
            test.each([
                'permissions=fullscreen=*',
                'permissions=autoplay=()',
                'permissions=geolocation=(self)',
                'permissions=geolocation=(self "https://example.com")',
                'permissions=geolocation=("https://example.com" "https://*.example.com")',
                'permissions=geolocation=("https://example.com"  "https://*.example.com")',
                // multiple permissions
                'permissions=storage-access=()\\, camera=()',
                'permissions=join-ad-interest-group=()\\, run-ad-auction=()\\, browsing-topics=()',
            ])('%s', (raw) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows, true);
                expect(ctx.valid).toBe(true);
            });
        });

        describe('invalid', () => {
            test.each([
                {
                    raw: 'permissions=wi-fi=()',
                    expectedMessage: 'Invalid permission directive',
                },
                {
                    raw: 'permissions=autoplay=self',
                    expectedMessage: 'Invalid allowlist format',
                },
                {
                    raw: 'permissions=autoplay=none',
                    expectedMessage: 'Invalid allowlist format',
                },
                {
                    raw: "permissions=autoplay=('*')",
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: 'permissions=autoplay=("*")',
                    expectedMessage: 'Invalid origin URL',
                },
                {
                    raw: 'permissions=autoplay=(',
                    expectedMessage: 'Invalid allowlist format',
                },
                {
                    raw: 'permissions=autoplay=)',
                    expectedMessage: 'Invalid allowlist format',
                },
                {
                    raw: 'permissions=autoplay=())',
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: 'permissions=autoplay=(() "https://example.com")',
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: 'permissions=autoplay=(* "https://example.com")',
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: 'permissions=autoplay=(* self)',
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: 'permissions=autoplay=(hello "https://example.com")',
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: 'permissions=autoplay=("hello" "https://example.com")',
                    expectedMessage: 'Invalid origin URL',
                },
                {
                    raw: 'permissions=autoplay=("hello" "world")',
                    expectedMessage: 'Invalid origin URL',
                },
                {
                    raw: 'permissions=geolocation=(https://example.com https://*.example.com)',
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: "permissions=geolocation=('https://example.com' 'https://*.example.com')",
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: "permissions=autoplay=()\\, geolocation=('self')",
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: 'permissions=autoplay=(() self))',
                    expectedMessage: 'Double quotes should be used for origins',
                },
                {
                    raw: 'permissions=autoplay=("()" self)',
                    expectedMessage: 'Invalid origin URL',
                },
                {
                    raw: 'permissions=geolocation=("https://example.com", "https://*.example.com")',
                    expectedMessage: 'Unescaped comma in permission',
                },
                {
                    raw: 'permissions=storage-access=()\\, \\, camera=()',
                    expectedMessage: 'Empty permission',
                },
            ])('$raw produces INVALID_PERMISSIONS_VALUE', ({ raw, expectedMessage }) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('INVALID_PERMISSIONS_VALUE');
                expect(ctx.issues?.[0]?.data?.message).toBe(expectedMessage);
            });
        });
    });

    describe('referrerpolicy_value', () => {
        describe('valid', () => {
            test.each([
                'referrerpolicy=no-referrer',
                'referrerpolicy=no-referrer-when-downgrade',
                'referrerpolicy=origin',
                'referrerpolicy=origin-when-cross-origin',
                'referrerpolicy=same-origin',
                'referrerpolicy=strict-origin',
                'referrerpolicy=strict-origin-when-cross-origin',
                'referrerpolicy=unsafe-url',
            ])('%s', (raw) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows, true);
                expect(ctx.valid).toBe(true);
            });
        });

        describe('invalid', () => {
            test.each([
                'referrerpolicy=autoplay=self',
                'referrerpolicy=no-origin',
                // non-latin "o" in "origin"
                'referrerpolicy=оrigin',
            ])('%s produces INVALID_REFERRER_POLICY_DIRECTIVE', (raw) => {
                const ctx = validateModifier(raw, Platform.AdgOsWindows);
                expect(ctx.valid).toBe(false);
                expect(ctx.issues?.[0]?.messageId).toBe('INVALID_REFERRER_POLICY_DIRECTIVE');
            });
        });
    });
});
