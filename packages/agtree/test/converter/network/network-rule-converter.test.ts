import { describe, test, expect } from 'vitest';

import { NetworkRuleConverter } from '../../../src/converter/network';
import { RuleConversionError } from '../../../src/errors/rule-conversion-error';
import { NetworkRuleParser } from '../../../src/parser/network/network-rule-parser';

describe('NetworkRuleConverter', () => {
    describe('convertToAdg', () => {
        test.each([
            // No modifiers
            {
                actual: 'example.com',
                expected: ['example.com'],
                shouldConvert: false,
            },
            {
                actual: '||example.com/image.png',
                expected: ['||example.com/image.png'],
                shouldConvert: false,
            },

            // Leave unknown modifiers as is
            {
                actual: 'example.com$aaa',
                expected: ['example.com$aaa'],
                shouldConvert: false,
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
                shouldConvert: false,
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
                shouldConvert: false,
            },
            {
                actual: '||example.com/resource$image,redirect=1x1-transparent.gif',
                expected: [
                    '||example.com/resource$image,redirect=1x1-transparent.gif',
                ],
                shouldConvert: false,
            },

            // Should handle $redirect-rule
            {
                actual: '||example.com/resource$redirect-rule=1x1-transparent.gif',
                expected: [
                    '||example.com/resource$redirect-rule=1x1-transparent.gif',
                ],
                shouldConvert: false,
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
                shouldConvert: false,
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

            // remove suffix from noop.js
            // https://github.com/AdguardTeam/tsurlfilter/issues/59#issuecomment-1673064170
            {
                actual: '||cdn.cookielaw.org^$important,redirect=noop.js:99,script,domain=open.spotify.com',
                expected: [
                    '||cdn.cookielaw.org^$important,redirect=noopjs,script,domain=open.spotify.com',
                ],
            },
            {
                actual: '||cdn.cookielaw.org^$important,redirect=noop.js:100,script,domain=open.spotify.com',
                expected: [
                    '||cdn.cookielaw.org^$important,redirect=noopjs,script,domain=open.spotify.com',
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(NetworkRuleConverter, 'convertToAdg');
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
                NetworkRuleConverter.convertToAdg(NetworkRuleParser.parse(actual));
            }).toThrow(new RuleConversionError(expected));
        });
    });

    describe('convertToUbo', () => {
        // Based on https://github.com/AdguardTeam/Scriptlets/blob/673d48442bb43c7e32caeaeee13a33f94985a9a2/tests/api/index.spec.js#L685-L781
        test.each([
            {
                actual: '||example.com^$script,redirect=noopjs:99',
                expected: ['||example.com^$script,redirect=noop.js'],
            },
            {
                actual: '@@||example.com^$script,redirect=noopjs:-1',
                expected: ['@@||example.com^$script,redirect=noop.js'],
            },
            {
                actual: '||example.com^$xmlhttprequest,redirect=nooptext',
                expected: ['||example.com^$xhr,redirect=noop.txt'],
            },
            {
                actual: '||example.com/*.css$important,redirect=noopcss',
                expected: ['||example.com/*.css$important,redirect=noop.css,stylesheet'],
            },
            {
                // image type is supported by nooptext too
                actual: '||example.com^$image,redirect=nooptext',
                expected: ['||example.com^$image,redirect=noop.txt'],
            },
            {
                // eslint-disable-next-line max-len
                actual: '||example.com/images/*.png$image,important,redirect=1x1-transparent.gif,domain=example.com|example.org',
                // eslint-disable-next-line max-len
                expected: ['||example.com/images/*.png$image,important,redirect=1x1.gif,domain=example.com|example.org'],
            },
            {
                actual: '||example.com/vast/$important,redirect=empty,~third-party',
                expected: ['||example.com/vast/$important,redirect=empty,~3p'],
            },
            {
                // add source type modifiers while conversion if there is no one of them
                // eslint-disable-next-line max-len
                actual: '||example.com/images/*.png$redirect=1x1-transparent.gif,domain=example.com|example.org,important',
                // eslint-disable-next-line max-len
                expected: ['||example.com/images/*.png$redirect=1x1.gif,domain=example.com|example.org,important,image'],
            },
            {
                actual: '||example.com/*.mp4$important,redirect=noopmp4-1s,~third-party',
                expected: ['||example.com/*.mp4$important,redirect=noop-1s.mp4,~3p,media'],
            },
            {
                actual: '||example.com/*.css$important,redirect=noopcss',
                expected: ['||example.com/*.css$important,redirect=noop.css,stylesheet'],
            },
            {
                actual: '||ad.example.com^$redirect=nooptext,important',
                // eslint-disable-next-line max-len
                expected: ['||ad.example.com^$redirect=noop.txt,important,image,media,subdocument,stylesheet,script,xhr,other'],
            },
            {
                // eslint-disable-next-line max-len
                actual: '||imasdk.googleapis.com/js/sdkloader/ima3.js$script,important,redirect=google-ima3,domain=example.org',
                // eslint-disable-next-line max-len
                expected: ['||imasdk.googleapis.com/js/sdkloader/ima3.js$script,important,redirect=google-ima.js,domain=example.org'],
            },
            // $redirect-rule
            {
                actual: '||example.com^$xmlhttprequest,redirect-rule=nooptext',
                expected: ['||example.com^$xhr,redirect-rule=noop.txt'],
            },
            {
                // image type is supported by nooptext too
                actual: '||example.com^$image,redirect-rule=nooptext',
                expected: ['||example.com^$image,redirect-rule=noop.txt'],
            },
            {
                // eslint-disable-next-line max-len
                actual: '||example.com/images/*.png$image,important,redirect-rule=1x1-transparent.gif,domain=example.com|example.org',
                // eslint-disable-next-line max-len
                expected: ['||example.com/images/*.png$image,important,redirect-rule=1x1.gif,domain=example.com|example.org'],
            },
            {
                actual: '||example.com/vast/$important,redirect-rule=empty,~third-party',
                expected: ['||example.com/vast/$important,redirect-rule=empty,~3p'],
            },
            {
                // add source type modifiers while conversion if there is no one of them
                // eslint-disable-next-line max-len
                actual: '||example.com/images/*.png$redirect-rule=1x1-transparent.gif,domain=example.com|example.org,important',
                // eslint-disable-next-line max-len
                expected: ['||example.com/images/*.png$redirect-rule=1x1.gif,domain=example.com|example.org,important,image'],
            },
            {
                actual: '||example.com/*.mp4$important,redirect-rule=noopmp4-1s,~third-party',
                expected: ['||example.com/*.mp4$important,redirect-rule=noop-1s.mp4,~3p,media'],
            },
            {
                actual: '||ad.example.com^$redirect-rule=nooptext,important',
                // eslint-disable-next-line max-len
                expected: ['||ad.example.com^$redirect-rule=noop.txt,important,image,media,subdocument,stylesheet,script,xhr,other'],
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(NetworkRuleConverter, 'convertToUbo');
        });
    });
});
