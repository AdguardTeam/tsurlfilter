import { ModifierValidator } from '../../src/validator';

describe('ModifierValidator', () => {
    describe('exists', () => {
        describe('modifier as string type', () => {
            const modifierValidator = new ModifierValidator();

            const supportedModifiers = [
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
                'empty',
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
                'mp4',
                'network',
                'object',
                'other',
                'permissions',
                'ping',
                'popunder',
                'popup',
                'redirect-rule',
                'redirect',
                'removeheader',
                'removeparam',
                'script',
                'specifichide',
                'stealth',
                'strict1p',
                'strict3p',
                'stylesheet',
                'subdocument',
                'third-party',
                'to',
                'urlblock',
                'webrtc',
                'websocket',
                'xmlhttprequest',
                // noop
                '_',
                // aliases are supported
                '3p',
                'ghide',
                'from',
                'frame',
                // negated modifiers are supported
                '~third-party',
            ];
            test.each(supportedModifiers)('%s', (modifierName) => {
                expect(modifierValidator.exists(modifierName)).toBeTruthy();
            });

            const unsupportedModifiers = [
                'invalid',
                // deprecated modifiers are not supported
                'object-subrequest',
                '',
                'domain=',
                // few modifiers are not supported
                'third-party,important',
            ];
            test.each(unsupportedModifiers)('%s', (modifierName) => {
                expect(modifierValidator.exists(modifierName)).toBeFalsy();
            });
        });

        describe('modifier as Modifier type', () => {
            const modifierValidator = new ModifierValidator();

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
                // invalid
                {
                    type: 'Modifier',
                    modifier: {
                        type: 'Value',
                        value: 'invalid',
                    },
                    exception: false,
                },
                // ~object-subrequest
                {
                    type: 'Modifier',
                    modifier: {
                        type: 'Value',
                        value: 'object-subrequest',
                    },
                    exception: true,
                },
            ];
            test.each(unsupportedModifiers)('$modifier.value', (modifierName) => {
                expect(modifierValidator.exists(modifierName)).toBeFalsy();
            });
        });
    });
});
