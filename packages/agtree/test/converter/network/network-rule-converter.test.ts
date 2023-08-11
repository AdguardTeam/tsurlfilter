import { NetworkRuleConverter } from '../../../src/converter/network';
import { RuleConversionError } from '../../../src/errors/rule-conversion-error';
import { NetworkRuleParser } from '../../../src/parser/network';

describe('NetworkRuleConverter', () => {
    describe('convertToAdg', () => {
        test.each([
            // No modifiers
            {
                actual: 'example.com',
                expected: ['example.com'],
            },
            {
                actual: '||example.com/image.png',
                expected: ['||example.com/image.png'],
            },

            // Leave unknown modifiers as is
            {
                actual: 'example.com$aaa',
                expected: ['example.com$aaa'],
            },
            {
                actual: 'example.com$aaa,1p,bbb',
                expected: ['example.com$aaa,~third-party,bbb'],
            },

            // Convert modifiers

            // first-party and 1p
            {
                actual: 'example.com$1p',
                expected: ['example.com$~third-party'],
            },
            {
                actual: 'example.com$first-party',
                expected: ['example.com$~third-party'],
            },
            {
                actual: 'example.com$~1p',
                expected: ['example.com$third-party'],
            },
            {
                actual: 'example.com$~first-party',
                expected: ['example.com$third-party'],
            },

            // 3p
            {
                actual: 'example.com$3p',
                expected: ['example.com$third-party'],
            },
            {
                actual: 'example.com$~3p',
                expected: ['example.com$~third-party'],
            },

            // xhr
            {
                actual: 'example.com$xhr',
                expected: ['example.com$xmlhttprequest'],
            },
            {
                actual: 'example.com$~xhr',
                expected: ['example.com$~xmlhttprequest'],
            },

            // css
            {
                actual: 'example.com$css',
                expected: ['example.com$stylesheet'],
            },
            {
                actual: 'example.com$~css',
                expected: ['example.com$~stylesheet'],
            },

            // frame
            {
                actual: 'example.com$frame',
                expected: ['example.com$subdocument'],
            },
            {
                actual: 'example.com$~frame',
                expected: ['example.com$~subdocument'],
            },

            // queryprune
            {
                actual: 'example.com$queryprune',
                expected: ['example.com$removeparam'],
            },
            {
                actual: 'example.com$~queryprune',
                expected: ['example.com$~removeparam'],
            },

            // doc
            {
                actual: 'example.com$doc',
                expected: ['example.com$document'],
            },
            {
                actual: 'example.com$~doc',
                expected: ['example.com$~document'],
            },

            // ghide
            {
                actual: 'example.com$ghide',
                expected: ['example.com$generichide'],
            },
            {
                actual: 'example.com$~ghide',
                expected: ['example.com$~generichide'],
            },

            // ehide
            {
                actual: 'example.com$ehide',
                expected: ['example.com$elemhide'],
            },
            {
                actual: 'example.com$~ehide',
                expected: ['example.com$~elemhide'],
            },

            // shide
            {
                actual: 'example.com$shide',
                expected: ['example.com$specifichide'],
            },
            {
                actual: 'example.com$~shide',
                expected: ['example.com$~specifichide'],
            },

            // empty
            {
                actual: 'example.com$empty',
                expected: ['example.com$redirect=nooptext'],
            },
            {
                actual: 'example.com$empty,important',
                expected: ['example.com$redirect=nooptext,important'],
            },

            // mp4
            {
                actual: 'example.com$mp4',
                expected: ['example.com$redirect=noopmp4-1s,media'],
            },
            {
                actual: 'example.com$mp4,important',
                expected: ['example.com$redirect=noopmp4-1s,media,important'],
            },

            // inline-script
            {
                actual: 'example.com$inline-script',
                // eslint-disable-next-line max-len
                expected: ['example.com$csp=script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
            },
            {
                actual: 'example.com$inline-script,important',
                // Note: $important precedes $csp because $csp handled at the end of the conversion
                // eslint-disable-next-line max-len
                expected: ['example.com$important,csp=script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
            },

            // inline-font
            {
                actual: 'example.com$inline-font',
                // eslint-disable-next-line max-len
                expected: ['example.com$csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
            },
            {
                actual: 'example.com$inline-font,important',
                // Note: $important precedes $csp because $csp handled at the end of the conversion
                // eslint-disable-next-line max-len
                expected: ['example.com$important,csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
            },

            // Combine multiple $csp
            {
                actual: 'example.com$inline-font,inline-script,important',
                // Note: $important precedes $csp because $csp handled at the end of the conversion
                // eslint-disable-next-line max-len
                expected: ['example.com$important,csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:; script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
            },

            // Should convert redirect resources

            // Leave unknown redirect names unchanged
            {
                actual: '||example.com/resource$redirect=this-redirect-name-does-not-exist',
                expected: [
                    '||example.com/resource$redirect=this-redirect-name-does-not-exist',
                ],
            },

            // Convert modifier but leave redirect name unchanged because it is unknown
            {
                actual: '||example.com/resource$rewrite=abp-resource:this-redirect-name-does-not-exist',
                expected: [
                    '||example.com/resource$redirect=abp-resource:this-redirect-name-does-not-exist',
                ],
            },

            // Should return the original redirect name if its already an ADG redirect name
            // (i.e. leave ADG redirect names unchanged)
            {
                actual: '||example.com/resource$redirect=1x1-transparent.gif',
                expected: [
                    '||example.com/resource$redirect=1x1-transparent.gif',
                ],
            },
            {
                actual: '||example.com/resource$image,redirect=1x1-transparent.gif',
                expected: [
                    '||example.com/resource$image,redirect=1x1-transparent.gif',
                ],
            },

            // Should handle $redirect-rule
            {
                actual: '||example.com/resource$redirect-rule=1x1-transparent.gif',
                expected: [
                    '||example.com/resource$redirect-rule=1x1-transparent.gif',
                ],
            },

            // Should convert uBO redirect names to ADG redirect names
            {
                actual: '||example.com/resource$redirect=1x1.gif',
                expected: [
                    '||example.com/resource$redirect=1x1-transparent.gif',
                ],
            },
            {
                actual: '||example.com/resource$image,redirect=1x1.gif',
                expected: [
                    '||example.com/resource$image,redirect=1x1-transparent.gif',
                ],
            },
            {
                actual: '||example.com/resource$script,redirect=nobab.js',
                expected: [
                    '||example.com/resource$script,redirect=prevent-bab',
                ],
            },

            // Just leave valid uBO redirect names unchanged if they aren't supported by ADG
            {
                actual: '||example.com/resource$script,redirect=outbrain-widget.js',
                expected: [
                    '||example.com/resource$script,redirect=outbrain-widget.js',
                ],
            },

            // Should convert ABP -> ADG
            {
                actual: '||example.com/resource$rewrite=1x1-transparent-gif',
                expected: [
                    '||example.com/resource$redirect=1x1-transparent.gif',
                ],
            },
            {
                actual: '||example.com/resource$stylesheet,rewrite=blank-css',
                expected: [
                    '||example.com/resource$stylesheet,redirect=noopcss',
                ],
            },

            // Should handle the case where the redirect name starts with 'abp-resource:'
            {
                actual: '||example.com/resource$script,rewrite=abp-resource:blank-js',
                expected: [
                    '||example.com/resource$script,redirect=noopjs',
                ],
            },
        ])("should convert '$actual' to '$expected'", ({ actual, expected }) => {
            expect(
                NetworkRuleConverter.convertToAdg(
                    NetworkRuleParser.parse(actual),
                ).map(NetworkRuleParser.generate),
            ).toEqual(expected);
        });

        // Invalid rules
        test.each([
            // Redirect modifiers should have a value
            {
                actual: '||example.com/resource$redirect',
                expected: 'No redirect resource specified for \'redirect\' modifier',
            },
            {
                actual: '||example.com/resource$redirect-rule',
                expected: 'No redirect resource specified for \'redirect-rule\' modifier',
            },
            {
                actual: '||example.com/resource$rewrite',
                expected: 'No redirect resource specified for \'rewrite\' modifier',
            },

            // Redirect modifiers can't be negated
            {
                actual: '||example.com/resource$~redirect=1x1-transparent.gif',
                expected: "Modifier 'redirect' cannot be negated",
            },
            {
                actual: '||example.com/resource$~redirect-rule=1x1-transparent.gif',
                expected: "Modifier 'redirect-rule' cannot be negated",
            },
            {
                actual: '||example.com/resource$~rewrite=abp-resource:blank-js',
                expected: "Modifier 'rewrite' cannot be negated",
            },
        ])("should throw '$expected' for '$actual'", ({ actual, expected }) => {
            expect(() => {
                NetworkRuleConverter.convertToAdg(
                    NetworkRuleParser.parse(actual),
                );
            }).toThrow(new RuleConversionError(expected));
        });
    });
});
