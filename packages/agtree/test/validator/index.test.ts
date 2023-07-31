import { Modifier } from '../../src/parser/common';
import { ModifierParser } from '../../src/parser/misc/modifier';
import { modifierValidator } from '../../src/validator';
import { StringUtils } from '../../src/utils/string';
import { INVALID_ERROR_PREFIX } from '../../src/validator/constants';
import { AdblockSyntax } from '../../src/utils/adblockers';

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
                'removeheader',
                'removeparam',
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
                    modifier: {
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
                    modifier: {
                        type: 'Value',
                        value: 'third-party',
                    },
                    exception: true,
                },
            ];
            test.each(supportedModifiers)('%s', (modifierName) => {
                expect(modifierValidator.exists(modifierName)).toBeTruthy();
            });

            const unsupportedModifiers = [
                {
                    type: 'Modifier',
                    modifier: {
                        type: 'Value',
                        value: 'protobuf',
                    },
                    exception: false,
                },
            ];
            test.each(unsupportedModifiers)('$modifier.value', (modifierName) => {
                expect(modifierValidator.exists(modifierName)).toBeFalsy();
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
            ];
            test.each(supportedModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                expect(validationResult.ok).toBeTruthy();
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
                expect(validationResult.ok).toBeTruthy();
                expect(validationResult.error).toBeUndefined();
                expect(validationResult.warn?.includes('support shall be removed in the future')).toBeTruthy();
            });
        });

        describe('unsupported', () => {
            const unsupportedModifiersCases = [
                {
                    actual: 'not-existent',
                    expected: INVALID_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'protobuf',
                    expected: INVALID_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'popunder',
                    expected: INVALID_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'object-subrequest',
                    expected: INVALID_ERROR_PREFIX.REMOVED,
                },
                {
                    actual: 'webrtc',
                    expected: INVALID_ERROR_PREFIX.REMOVED,
                },
                {
                    actual: '~popup',
                    expected: INVALID_ERROR_PREFIX.NOT_NEGATABLE,
                },
                {
                    actual: '~domain=example.com',
                    expected: INVALID_ERROR_PREFIX.NOT_NEGATABLE,
                },
                {
                    actual: '~app',
                    expected: INVALID_ERROR_PREFIX.NOT_NEGATABLE,
                },
                {
                    actual: 'domain',
                    expected: INVALID_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'denyallow',
                    expected: INVALID_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'network=8.8.8.8',
                    expected: INVALID_ERROR_PREFIX.VALUE_FORBIDDEN,
                },
                {
                    actual: 'third-party=true',
                    expected: INVALID_ERROR_PREFIX.VALUE_FORBIDDEN,
                },
            ];
            test.each(unsupportedModifiersCases)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier);
                expect(validationResult.ok).toBeFalsy();
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
                expect(validationResult.ok).toBeFalsy();
                expect(validationResult.error?.startsWith(INVALID_ERROR_PREFIX.EXCEPTION_ONLY)).toBeTruthy();
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
                expect(validationResult.ok).toBeTruthy();
            });
        });

        describe('only for exception rules', () => {
            const invalidForExceptionRuleModifiers = [
                {
                    actual: 'all',
                    expected: INVALID_ERROR_PREFIX.BLOCK_ONLY,
                },
            ];
            test.each(invalidForExceptionRuleModifiers)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                // third argument is 'true' for exception rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, true);
                expect(validationResult.ok).toBeFalsy();
                expect(validationResult.error?.startsWith(expected)).toBeTruthy();
            });

            const validForExceptionRuleModifiers = [
                'important',
                'jsinject',
                'stealth',
                'stealth=dpi',
            ];
            test.each(validForExceptionRuleModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // third argument is 'true' for exception rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Adg, modifier, true);
                expect(validationResult.ok).toBeTruthy();
            });
        });
    });

    describe('validate for UblockOrigin', () => {
        describe('supported', () => {
            const supportedModifiers = [
                'all',
                '~third-party',
                'badfilter',
                'popunder',
            ];
            test.each(supportedModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier);
                expect(validationResult.ok).toBeTruthy();
            });
        });

        describe('unsupported', () => {
            const unsupportedModifiersCases = [
                {
                    actual: 'not-existent',
                    expected: INVALID_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'protobuf',
                    expected: INVALID_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'webrtc',
                    expected: INVALID_ERROR_PREFIX.REMOVED,
                },
                {
                    actual: 'genericblock',
                    expected: INVALID_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'object-subrequest',
                    expected: INVALID_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'app=com.test.app',
                    expected: INVALID_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'jsinject',
                    expected: INVALID_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: '~popup',
                    expected: INVALID_ERROR_PREFIX.NOT_NEGATABLE,
                },
                {
                    actual: '~domain=example.com',
                    expected: INVALID_ERROR_PREFIX.NOT_NEGATABLE,
                },
                {
                    actual: 'domain',
                    expected: INVALID_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'denyallow',
                    expected: INVALID_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'third-party=true',
                    expected: INVALID_ERROR_PREFIX.VALUE_FORBIDDEN,
                },
            ];
            test.each(unsupportedModifiersCases)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier);
                expect(validationResult.ok).toBeFalsy();
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
                expect(validationResult.ok).toBeFalsy();
                expect(validationResult.error?.startsWith(INVALID_ERROR_PREFIX.EXCEPTION_ONLY)).toBeTruthy();
            });

            const validForBlockingRuleModifiers = [
                // no problem with 'popunder' modifier for blocking rules
                'popunder',
            ];
            test.each(validForBlockingRuleModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // third argument is 'false' for blocking rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier, false);
                expect(validationResult.ok).toBeTruthy();
            });
        });

        describe('only for exception rules', () => {
            const invalidForExceptionRuleModifiers = [
                {
                    actual: 'popunder',
                    expected: INVALID_ERROR_PREFIX.BLOCK_ONLY,
                },
            ];
            test.each(invalidForExceptionRuleModifiers)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                // third argument is 'true' for exception rules
                const validationResult = modifierValidator.validate(AdblockSyntax.Ubo, modifier, true);
                expect(validationResult.ok).toBeFalsy();
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
                expect(validationResult.ok).toBeTruthy();
            });
        });
    });

    describe('validate for AdblockPlus', () => {
        describe('supported', () => {
            const supportedModifiers = [
                'domain=example.com',
                'third-party',
                // 'webrtc' is fully supported by ABP, not deprecated
                'webrtc',
            ];
            test.each(supportedModifiers)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                const validationResult = modifierValidator.validate(AdblockSyntax.Abp, modifier);
                expect(validationResult.ok).toBeTruthy();
            });
        });

        describe('unsupported', () => {
            const unsupportedModifiersCases = [
                {
                    actual: 'not-existent',
                    expected: INVALID_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'protobuf',
                    expected: INVALID_ERROR_PREFIX.NOT_EXISTENT,
                },
                {
                    actual: 'object-subrequest',
                    expected: INVALID_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'app=com.test.app',
                    expected: INVALID_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'jsinject',
                    expected: INVALID_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: 'denyallow',
                    expected: INVALID_ERROR_PREFIX.NOT_SUPPORTED,
                },
                {
                    actual: '~popup',
                    expected: INVALID_ERROR_PREFIX.NOT_NEGATABLE,
                },
                {
                    actual: '~domain=example.com',
                    expected: INVALID_ERROR_PREFIX.NOT_NEGATABLE,
                },
                {
                    actual: 'domain',
                    expected: INVALID_ERROR_PREFIX.VALUE_REQUIRED,
                },
                {
                    actual: 'third-party=true',
                    expected: INVALID_ERROR_PREFIX.VALUE_FORBIDDEN,
                },
            ];
            test.each(unsupportedModifiersCases)('$actual', ({ actual, expected }) => {
                const modifier = getModifier(actual);
                const validationResult = modifierValidator.validate(AdblockSyntax.Abp, modifier);
                expect(validationResult.ok).toBeFalsy();
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
                expect(validationResult.ok).toBeFalsy();
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
                expect(validationResult.ok).toBeTruthy();
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
