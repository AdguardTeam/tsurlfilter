import { ModifierValidator } from '../../src/validator';

describe('ModifierValidator', () => {
    describe('exists', () => {
        describe('modifier as string type', () => {
            const modifierValidator = new ModifierValidator();

            const supportedModifiers = [
                'app',
                'domain',
                'jsinject',
                'redirect-rule',
                'removeheader',
                'hls',
                'script',
                'xmlhttprequest',
                'third-party',
                '3p',
                // aliases are supported
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
                'empty',
                'mp4',
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
                // empty
                {
                    type: 'Modifier',
                    modifier: {
                        type: 'Value',
                        value: 'empty',
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
            test.each(unsupportedModifiers)('%s', (modifierName) => {
                expect(modifierValidator.exists(modifierName)).toBeFalsy();
            });
        });
    });
});
