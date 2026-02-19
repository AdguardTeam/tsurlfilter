import { describe, expect, test } from 'vitest';
import { sprintf } from 'sprintf-js';

import { type Modifier } from '../../src/nodes';
import { ModifierParser } from '../../src/parser/misc/modifier-parser';
import { modifierValidator } from '../../src/validator';
import { StringUtils } from '../../src/utils/string';
import { VALIDATION_ERROR_PREFIX } from '../../src/validator/constants';
import { GenericPlatform, getHumanReadablePlatformName, SpecificPlatform } from '../../src/compatibility-tables';

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
                const validationResult = modifierValidator.validate(SpecificPlatform.AdgOsWindows, modifier);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AdgOsWindows, modifier);
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
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.AdgOsWindows)),
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AdgOsWindows, modifier);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AdgOsWindows, modifier, false);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AdgOsWindows, modifier, false);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AdgOsWindows, modifier, true);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AdgOsWindows, modifier, true);
                expect(validationResult.valid).toBeTruthy();
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
                const validationResult = modifierValidator.validate(SpecificPlatform.UboExtFirefox, modifier);
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
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.UboExtFirefox)),
                },
                {
                    actual: 'object-subrequest',
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.UboExtFirefox)),
                },
                {
                    actual: 'app=com.test.app',
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.UboExtFirefox)),
                },
                {
                    actual: 'jsinject',
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.UboExtFirefox)),
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
                const validationResult = modifierValidator.validate(SpecificPlatform.UboExtFirefox, modifier);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.UboExtFirefox, modifier, false);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.UboExtFirefox, modifier, false);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.UboExtFirefox, modifier, true);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.UboExtFirefox, modifier, true);
                expect(validationResult.valid).toBeTruthy();
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AbpExtChrome, modifier);
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
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.AbpExtChrome)),
                },
                {
                    actual: 'app=com.test.app',
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.AbpExtChrome)),
                },
                {
                    actual: 'jsinject',
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.AbpExtChrome)),
                },
                {
                    actual: 'denyallow',
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.AbpExtChrome)),
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
                    // eslint-disable-next-line max-len
                    expected: sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(SpecificPlatform.AbpExtChrome)),
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AbpExtChrome, modifier);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AbpExtChrome, modifier, false);
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
                const validationResult = modifierValidator.validate(SpecificPlatform.AbpExtChrome, modifier, false);
                expect(validationResult.valid).toBeTruthy();
            });
        });
    });

    /* eslint-disable no-bitwise */
    describe('skip validation for multiple products', () => {
        describe('valid - validation skipped', () => {
            const modifiersToTest = [
                // AdGuard-specific modifiers should pass with multiple products
                'app=com.test.app',
                'jsinject',
                'stealth',
                // uBlock-specific modifiers should pass with multiple products
                'popunder',
                // Removed modifiers should pass with multiple products
                'webrtc',
                'object-subrequest',
            ];
            test.each(modifiersToTest)('%s', (rawModifier) => {
                const modifier = getModifier(rawModifier);
                // Test AdgAny | UboAny combination
                const validationResult1 = modifierValidator.validate(
                    (GenericPlatform.AdgAny | GenericPlatform.UboAny) as GenericPlatform,
                    modifier,
                );
                expect(validationResult1.valid).toBeTruthy();
                expect(validationResult1.error).toBeUndefined();
                expect(validationResult1.warn).toBeUndefined();

                // Test AdgAny | AbpAny combination
                const validationResult2 = modifierValidator.validate(
                    (GenericPlatform.AdgAny | GenericPlatform.AbpAny) as GenericPlatform,
                    modifier,
                );
                expect(validationResult2.valid).toBeTruthy();
                expect(validationResult2.error).toBeUndefined();
                expect(validationResult2.warn).toBeUndefined();

                // Test UboAny | AbpAny combination
                const validationResult3 = modifierValidator.validate(
                    (GenericPlatform.UboAny | GenericPlatform.AbpAny) as GenericPlatform,
                    modifier,
                );
                expect(validationResult3.valid).toBeTruthy();
                expect(validationResult3.error).toBeUndefined();
                expect(validationResult3.warn).toBeUndefined();

                // Test all three products combined
                const validationResult4 = modifierValidator.validate(
                    (GenericPlatform.AdgAny | GenericPlatform.UboAny | GenericPlatform.AbpAny) as GenericPlatform,
                    modifier,
                );
                expect(validationResult4.valid).toBeTruthy();
                expect(validationResult4.error).toBeUndefined();
                expect(validationResult4.warn).toBeUndefined();
            });
        });

        describe('single product - validation not skipped', () => {
            // These modifiers would normally fail for specific products
            const adguardSpecificModifiers = [
                {
                    modifier: 'app=com.test.app',
                    invalidFor: [SpecificPlatform.UboExtFirefox, SpecificPlatform.AbpExtChrome],
                },
                {
                    modifier: 'jsinject',
                    invalidFor: [SpecificPlatform.UboExtFirefox, SpecificPlatform.AbpExtChrome],
                },
            ];

            test.each(adguardSpecificModifiers)(
                '$modifier should fail for non-AdGuard products',
                ({ modifier: rawModifier, invalidFor }) => {
                    const modifier = getModifier(rawModifier);
                    invalidFor.forEach((platform) => {
                        const validationResult = modifierValidator.validate(platform, modifier);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error).toBeDefined();
                    });
                },
            );

            const uboSpecificModifiers = [
                {
                    modifier: 'popunder',
                    invalidFor: [SpecificPlatform.AdgOsWindows],
                },
            ];

            test.each(uboSpecificModifiers)(
                '$modifier should fail for non-uBlock products',
                ({ modifier: rawModifier, invalidFor }) => {
                    const modifier = getModifier(rawModifier);
                    invalidFor.forEach((platform) => {
                        const validationResult = modifierValidator.validate(platform, modifier, false);
                        expect(validationResult.valid).toBeFalsy();
                        expect(validationResult.error).toBeDefined();
                    });
                },
            );
        });

        describe('edge cases', () => {
            test('deprecated modifiers should pass with multiple products', () => {
                const modifier = getModifier('empty');
                const validationResult = modifierValidator.validate(
                    (GenericPlatform.AdgAny | GenericPlatform.UboAny) as GenericPlatform,
                    modifier,
                );
                expect(validationResult.valid).toBeTruthy();
                // When validation is skipped, no warnings should be present
                expect(validationResult.warn).toBeUndefined();
            });

            test('value validation should be skipped with multiple products', () => {
                // Invalid domain value that would normally fail
                const modifier = getModifier('domain=~~example.com');
                const validationResult = modifierValidator.validate(
                    (GenericPlatform.AdgAny | GenericPlatform.UboAny) as GenericPlatform,
                    modifier,
                );
                expect(validationResult.valid).toBeTruthy();
                expect(validationResult.error).toBeUndefined();
            });

            test('exception-only modifiers should pass in blocking rules with multiple products', () => {
                const modifier = getModifier('elemhide');
                // Third argument is 'false' for blocking rules
                // This would normally fail because elemhide is exception-only for AdGuard
                const validationResult = modifierValidator.validate(
                    (GenericPlatform.AdgAny | GenericPlatform.UboAny) as GenericPlatform,
                    modifier,
                    false,
                );
                expect(validationResult.valid).toBeTruthy();
                expect(validationResult.error).toBeUndefined();
            });

            test('block-only modifiers should pass in exception rules with multiple products', () => {
                const modifier = getModifier('all');
                // Third argument is 'true' for exception rules
                // This would normally fail because 'all' is block-only for AdGuard
                const validationResult = modifierValidator.validate(
                    (GenericPlatform.AdgAny | GenericPlatform.UboAny) as GenericPlatform,
                    modifier,
                    true,
                );
                expect(validationResult.valid).toBeTruthy();
                expect(validationResult.error).toBeUndefined();
            });
        });
    });
    /* eslint-enable no-bitwise */
});
