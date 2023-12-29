/**
 * @file Integration tests for the converter
 * @todo Remove redundant tests
 *
 * Mainly tests are taken from the old converter tests:
 * https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L386
 */

import { RuleConversionError } from '../../src/errors/rule-conversion-error';
import { RuleConverter } from '../../src/converter/rule';
import '../matchers/check-conversion';
import { RuleParser } from '../../src/parser/rule';

describe('Converter integration tests', () => {
    describe('should convert rules to ADG', () => {
        // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L107
        describe('should convert uBO comments', () => {
            test.each([
                {
                    actual: '! Comment',
                    expected: ['! Comment'],
                    shouldConvert: false,
                },
                // uBO-specific comment
                {
                    actual: '# Comment',
                    expected: ['! # Comment'],
                },
                {
                    actual: '# ubo syntax comment',
                    expected: ['! # ubo syntax comment'],
                },
                {
                    actual: '#####',
                    expected: ['! #####'],
                },
                // Leave cosmetic rules as-is
                {
                    actual: '##selector',
                    expected: ['##selector'],
                    shouldConvert: false,
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });
        });

        // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L52
        describe('should convert valid uBO HTML filtering rules', () => {
            test.each([
                {
                    actual: 'example.com##^script:has-text(12313)',
                    expected: ['example.com$$script[tag-content="12313"][max-length="262144"]'],
                },
                {
                    actual: 'example.com##^script:has-text(console.log("doubles"))',
                    expected: ['example.com$$script[tag-content="console.log(""doubles"")"][max-length="262144"]'],
                },
                {
                    actual: 'example.com##^script[data-test]:has-text(12313)',
                    expected: ['example.com$$script[data-test][tag-content="12313"][max-length="262144"]'],
                },
                {
                    actual: 'example.com##^script[data-test="1"][data-test2="2"]:has-text(12313)',
                    expected: [
                        'example.com$$script[data-test="1"][data-test2="2"][tag-content="12313"][max-length="262144"]',
                    ],
                },
                {
                    actual: "example.com##^script:has-text(d.createElement('script'))",
                    expected: ['example.com$$script[tag-content="d.createElement(\'script\')"][max-length="262144"]'],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });
        });

        describe('should throw error on invalid uBO HTML filtering rules', () => {
            test.each([
                {
                    actual: 'example.com##^body > script:has-text(test)',
                    expected: "Unexpected token '<delim-token>' with value '>'",
                },
                {
                    actual: 'example.com##^script:some-another-rule(test)',
                    expected: "Unsupported pseudo class 'some-another-rule'",
                },
            ])("should throw error '$expected' on '$actual'", ({ actual, expected }) => {
                expect(() => RuleConverter.convertToAdg(RuleParser.parse(actual))).toThrowError(
                    new RuleConversionError(expected),
                );
            });
        });

        // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L525
        describe('should convert uBO cosmetic rule modifiers', () => {
            test.each([
                {
                    actual: 'ya.ru##:matches-path(/page)p',
                    expected: ['[$path=/page]ya.ru##p'],
                },
                {
                    actual: 'ya.ru#@#:matches-path(/page)p',
                    expected: ['[$path=/page]ya.ru#@#p'],
                },
                {
                    actual: 'ya.ru#@#p:matches-path(/page)',
                    expected: ['[$path=/page]ya.ru#@#p'],
                },
                {
                    actual: String.raw`ya.ru##:matches-path(/\/(sub1|sub2)\/page\.html/)p`,
                    expected: [String.raw`[$path=/\\/(sub1|sub2)\\/page\\.html/]ya.ru##p`],
                },
                {
                    actual: String.raw`ya.ru##:not(:matches-path(/\/(sub1|sub2)\/page\.html/))p`,
                    expected: [String.raw`[$path=/^((?!\\/(sub1|sub2)\\/page\\.html).)*$/]ya.ru##p`],
                },
                {
                    actual: 'ya.ru##:not(:matches-path(/page))p',
                    expected: [String.raw`[$path=/^((?!\/page).)*$/]ya.ru##p`],
                },
                {
                    actual: 'ya.ru##p:not(:matches-path(/page))',
                    expected: [String.raw`[$path=/^((?!\/page).)*$/]ya.ru##p`],
                },
                {
                    // eslint-disable-next-line max-len
                    actual: 'blog.livedoor.jp##:matches-path(/sexykpopidol) #containerWrap > #container > .blog-title-outer + #content.hfeed',
                    // eslint-disable-next-line max-len
                    expected: ['[$path=/sexykpopidol]blog.livedoor.jp###containerWrap > #container > .blog-title-outer + #content.hfeed'],
                },
                {
                    actual: String.raw`www.google.*##:not(:matches-path(/\/search\?q=.*?tbm=shop/)) #test`,
                    expected: [String.raw`[$path=/^((?!\\/search\\?q=.*?tbm=shop).)*$/]www.google.*###test`],
                },
                {
                    actual: String.raw`exapmle.com##:matches-path(/\/[a|b|,]\/page\.html/) #test`,
                    expected: [String.raw`[$path=/\\/\[a|b|\,\]\\/page\\.html/]exapmle.com###test`],
                },
                {
                    actual: 'example.com#@#:not(:matches-path(/page))h1:style(background-color: blue !important)',
                    // eslint-disable-next-line max-len
                    expected: [String.raw`[$path=/^((?!\/page).)*$/]example.com#@$#h1 { background-color: blue !important }`],
                },
                {
                    // eslint-disable-next-line max-len
                    actual: String.raw`example.org##:matches-path(/\/(sub1|sub2)\/page\.html/)p:has-text(/[\w\W]{30,}/):style(background: #ff0033 !important;)`,
                    // eslint-disable-next-line max-len
                    expected: [String.raw`[$path=/\\/(sub1|sub2)\\/page\\.html/]example.org#$?#p:contains(/[\w\W]{30,}/) { background: #ff0033 !important; }`],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });
        });

        // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L192
        describe('should convert uBO responseheader rules', () => {
            test.each([
                {
                    actual: 'ya.ru##^responseheader(header-name)',
                    expected: ['||ya.ru^$removeheader=header-name'],
                },
                {
                    actual: 'ya.ru#@#^responseheader(header-name)',
                    expected: ['@@||ya.ru^$removeheader=header-name'],
                },
                {
                    actual: '! ya.ru#@#^responseheader(header-name)',
                    expected: ['! ya.ru#@#^responseheader(header-name)'],
                    shouldConvert: false,
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });
        });

        // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L121
        describe('should convert uBO CSS injection rules', () => {
            test.each([
                {
                    actual: 'example.com##h1:style(background-color: blue !important)',
                    expected: ['example.com#$#h1 { background-color: blue !important }'],
                },
                {
                    actual: 'example.com#@#h1:style(background-color: blue !important)',
                    expected: ['example.com#@$#h1 { background-color: blue !important }'],
                },
                {
                    actual: 'example.org##p:has-text(/[\\w\\W]{30,}/):style(background: #ff0033 !important;)',
                    expected: ['example.org#$?#p:contains(/[\\w\\W]{30,}/) { background: #ff0033 !important; }'],
                },

                // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L170
                {
                    actual: 'yourconroenews.com#@##siteNav:style(transform: none !important;)',
                    expected: ['yourconroenews.com#@$##siteNav { transform: none !important; }'],
                },

                // :remove()
                // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L177
                {
                    actual: 'ekoteka.pl###popUpModal:remove()',
                    expected: ['ekoteka.pl#$?##popUpModal { remove: true; }'],
                },
                {
                    actual: 'aftonbladet.se##.jwplayer:has(.svp-sponsor-label):remove()',
                    expected: ['aftonbladet.se#$?#.jwplayer:has(.svp-sponsor-label) { remove: true; }'],
                },
                {
                    actual: 'example.org#?##case26:remove()',
                    expected: ['example.org#$?##case26 { remove: true; }'],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });
        });

        // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L217
        describe('should convert pseudo elements', () => {
            test.each([
                // single :before
                {
                    actual: 'hotline.ua##.reset-scroll:before',
                    expected: ['hotline.ua##.reset-scroll::before'],
                },
                // single :after
                {
                    actual: 'hotline.ua##.reset-scroll:after',
                    expected: ['hotline.ua##.reset-scroll::after'],
                },
                // multiple :before
                {
                    actual: 'hotline.ua##.reset-scroll:before, .class:before',
                    expected: ['hotline.ua##.reset-scroll::before, .class::before'],
                },
                // multiple :after
                {
                    actual: 'hotline.ua##.reset-scroll:after, .class:after',
                    expected: ['hotline.ua##.reset-scroll::after, .class::after'],
                },
                // CSS injection rules
                {
                    actual: 'militaria.pl#$##layout-wrapper:before { height: 0 !important; }',
                    expected: ['militaria.pl#$##layout-wrapper::before { height: 0 !important; }'],
                },
                {
                    actual: 'militaria.pl#$##layout-wrapper:after { height: 0 !important; }',
                    expected: ['militaria.pl#$##layout-wrapper::after { height: 0 !important; }'],
                },
                // do not add extra colon
                {
                    actual: 'hotline.ua##.reset-scroll::before',
                    expected: ['hotline.ua##.reset-scroll::before'],
                    shouldConvert: false,
                },
                {
                    actual: 'hotline.ua##.reset-scroll::after',
                    expected: ['hotline.ua##.reset-scroll::after'],
                    shouldConvert: false,
                },
                {
                    actual: 'hotline.ua##.reset-scroll::before, .class::before',
                    expected: ['hotline.ua##.reset-scroll::before, .class::before'],
                    shouldConvert: false,
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });
        });

        // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L206
        describe('should keep cosmetic rules', () => {
            test.each([
                {
                    actual: 'ferra.ru##div[data-render-state] + div[class^="jsx-"][class$=" undefined"]',
                    expected: ['ferra.ru##div[data-render-state] + div[class^="jsx-"][class$=" undefined"]'],
                    shouldConvert: false,
                },
                {
                    actual: 'example.org#%#var str = /[class$=" undefined"]/; console.log(str);',
                    expected: ['example.org#%#var str = /[class$=" undefined"]/; console.log(str);'],
                    shouldConvert: false,
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });
        });

        // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L272
        describe('should convert network rule options', () => {
            test.each([
                // converts empty and mp4 modifiers into redirect rules
                {
                    actual: '/(pagead2)/$domain=vsetv.com,empty,important',
                    expected: ['/(pagead2)/$domain=vsetv.com,redirect=nooptext,important'],
                },
                {
                    actual: '||fastmap33.com^$empty',
                    expected: ['||fastmap33.com^$redirect=nooptext'],
                },

                // converts ubo nobab into prevent-bab redirect rule
                {
                    actual: '/blockadblock.$script,redirect=nobab.js',
                    expected: ['/blockadblock.$script,redirect=prevent-bab'],
                },

                // checks $mp4 modifier should always go with $media modifier together
                {
                    actual: '||video.example.org^$mp4',
                    expected: ['||video.example.org^$redirect=noopmp4-1s,media'],
                },
                {
                    actual: '||video.example.org^$media,mp4',
                    expected: ['||video.example.org^$media,redirect=noopmp4-1s'],
                },
                {
                    actual: '||video.example.org^$media,mp4,domain=example.org',
                    expected: ['||video.example.org^$media,redirect=noopmp4-1s,domain=example.org'],
                },
                {
                    actual: '||video.example.org^$mp4,domain=example.org,media',
                    expected: ['||video.example.org^$redirect=noopmp4-1s,media,domain=example.org'],
                },

                // converts inline-script modifier into csp rule
                {
                    actual: '||vcrypt.net^$inline-script',
                    // eslint-disable-next-line max-len
                    expected: ['||vcrypt.net^$csp=script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
                },
                {
                    actual: '||vcrypt.net^$frame,inline-script',
                    // eslint-disable-next-line max-len
                    expected: ['||vcrypt.net^$subdocument,csp=script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
                },

                // converts inline-font modifier into csp rule
                {
                    actual: '||vcrypt.net^$inline-font',
                    // eslint-disable-next-line max-len
                    expected: ['||vcrypt.net^$csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
                },
                {
                    actual: '||vcrypt.net^$inline-font,domain=example.org',
                    // eslint-disable-next-line max-len
                    expected: ['||vcrypt.net^$domain=example.org,csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:'],
                },

                // converts ghide, ehide, shide options
                {
                    actual: '@@||example.com^$ghide',
                    expected: ['@@||example.com^$generichide'],
                },
                {
                    actual: '@@||example.com^$shide',
                    expected: ['@@||example.com^$specifichide'],
                },
                {
                    actual: '@@||example.com^$ehide',
                    expected: ['@@||example.com^$elemhide'],
                },
                {
                    actual: '@@||example.com^$ehide,jsinject',
                    expected: ['@@||example.com^$elemhide,jsinject'],
                },

                // converts queryprune options
                {
                    actual: '@@||example.com^$queryprune',
                    expected: ['@@||example.com^$removeparam'],
                },
                {
                    actual: '@@||example.com^$queryprune,jsinject',
                    expected: ['@@||example.com^$removeparam,jsinject'],
                },
                {
                    actual: '@@||example.com^$queryprune=test,jsinject',
                    expected: ['@@||example.com^$removeparam=test,jsinject'],
                },

                // converts doc options
                {
                    actual: '@@||example.com^$doc',
                    expected: ['@@||example.com^$document'],
                },
                {
                    actual: '@@||example.com^$doc,jsinject',
                    expected: ['@@||example.com^$document,jsinject'],
                },

                // converts css options
                {
                    actual: 'example.com$css',
                    expected: ['example.com$stylesheet'],
                },
                {
                    actual: 'example.com$~css',
                    expected: ['example.com$~stylesheet'],
                },
                // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L135
                {
                    actual: 'csoonline.com,csswizardry.com##.ad',
                    expected: ['csoonline.com,csswizardry.com##.ad'],
                    shouldConvert: false,
                },
                {
                    actual: '$image,css,domain=salefiles.com',
                    expected: ['$image,stylesheet,domain=salefiles.com'],
                },
                {
                    actual: '$css,domain=salefiles.com',
                    expected: ['$stylesheet,domain=salefiles.com'],
                },
                {
                    actual: '-ad-manager/$~css',
                    expected: ['-ad-manager/$~stylesheet'],
                },
                {
                    actual: '-ad-manager/$css,script',
                    expected: ['-ad-manager/$stylesheet,script'],
                },
                {
                    actual: 'example.org$script,css',
                    expected: ['example.org$script,stylesheet'],
                },

                // converts xhr options
                {
                    actual: 'example.com$xhr',
                    expected: ['example.com$xmlhttprequest'],
                },
                {
                    actual: 'example.com$~xhr',
                    expected: ['example.com$~xmlhttprequest'],
                },

                // converts rule with $all modifier into one rule
                {
                    actual: '||example.org^$all',
                    expected: ['||example.org^$all'],
                    shouldConvert: false,
                },
                {
                    actual: '||example.org^$all,important',
                    expected: ['||example.org^$all,important'],
                    shouldConvert: false,
                },

                // does not add unnecessary symbols while converting redirects
                {
                    actual: 'intermarche.pl#%#document.cookie = "interapp_redirect=false; path=/;";',
                    expected: ['intermarche.pl#%#document.cookie = "interapp_redirect=false; path=/;";'],
                    shouldConvert: false,
                },

                // does not converts options in the cosmetic rules
                {
                    actual: 'bitly.com,framestr.com,nytimes.com#@#.share-btn',
                    expected: ['bitly.com,framestr.com,nytimes.com#@#.share-btn'],
                    shouldConvert: false,
                },

                // converts 1p,3p options
                {
                    actual: '||vidads.gr^$3p',
                    expected: ['||vidads.gr^$third-party'],
                },
                {
                    actual: '@@.com/ads.js|$3p,domain=~3ppt.com',
                    expected: ['@@.com/ads.js|$third-party,domain=~3ppt.com'],
                },
                {
                    actual: '||www.ynet.co.il^$important,websocket,1p,domain=www.ynet.co.il',
                    expected: ['||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il'],
                },
                {
                    actual: 'spiele-umsonst.de##.left > div.right[style$="1px;"]',
                    expected: ['spiele-umsonst.de##.left > div.right[style$="1px;"]'],
                    shouldConvert: false,
                },

                // converts removeparam option properly
                {
                    actual: String.raw`||example.org^$removeparam=/^__s=[A-Za-z0-9]{6\,}/`,
                    expected: [String.raw`||example.org^$removeparam=/^__s=[A-Za-z0-9]{6\,}/`],
                    shouldConvert: false,
                },

                // converts hls option properly
                {
                    actual: String.raw`||example.org^$hls=/#UPLYNK-SEGMENT:.*\,ad/t`,
                    expected: [String.raw`||example.org^$hls=/#UPLYNK-SEGMENT:.*\,ad/t`],
                    shouldConvert: false,
                },

                // converts jsonprune option properly
                {
                    actual: '||example.org/*/*/$xmlhttprequest,jsonprune=\\$..[ac\\, ab]',
                    expected: ['||example.org/*/*/$xmlhttprequest,jsonprune=\\$..[ac\\, ab]'],
                    shouldConvert: false,
                },

                // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L46
                {
                    actual: String.raw`/\/\?[0-9a-zA-Z]{32}&[0-9]{5}&(https?|undefined$)/$1p,script`,
                    expected: [String.raw`/\/\?[0-9a-zA-Z]{32}&[0-9]{5}&(https?|undefined$)/$~third-party,script`],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });
        });

        // https://github.com/AdguardTeam/tsurlfilter/blob/7de315b85675ddafaa7457ee1b0c77ddc79f25f0/packages/tsurlfilter/test/rules/rule-converter.test.ts#L386
        describe('should convert scriptlet injection rules', () => {
            test.each([
                // leave ADG scriptlet injection rules as is
                {
                    actual: "example.org#%#//scriptlet('abort-on-property-read', 'I10C')",
                    expected: ["example.org#%#//scriptlet('abort-on-property-read', 'I10C')"],
                    shouldConvert: false,
                },
                {
                    actual: "example.org#@%#//scriptlet('abort-on-property-read', 'I10C')",
                    expected: ["example.org#@%#//scriptlet('abort-on-property-read', 'I10C')"],
                    shouldConvert: false,
                },

                // should convert uBO scriptlet injection rules
                {
                    actual: 'example.org##+js(setTimeout-defuser.js, [native code], 8000)',
                    expected: ['example.org#%#//scriptlet(\'ubo-setTimeout-defuser.js\', \'[native code]\', \'8000\')'],
                },
                {
                    actual: 'example.org#@#+js(setTimeout-defuser.js, [native code], 8000)',
                    // eslint-disable-next-line max-len
                    expected: ['example.org#@%#//scriptlet(\'ubo-setTimeout-defuser.js\', \'[native code]\', \'8000\')'],
                },

                // TODO: Add support for `script:inject` syntax in AGTree
                // {
                //     actual: 'example.org#@#script:inject(abort-on-property-read.js, some.prop)',
                //     expected: ['example.org#@%#//scriptlet(\'ubo-abort-on-property-read.js\', \'some.prop\')'],
                // },

                {
                    actual: 'example.org##+js(ra.js, href, a#promo\\, div > .promo\\, a[href*="target"])',
                    // eslint-disable-next-line max-len
                    expected: ['example.org#%#//scriptlet(\'ubo-ra.js\', \'href\', \'a#promo\\, div > .promo\\, a[href*="target"]\')'],
                },

                // should convert ABP snippet injection rules
                {
                    actual: "example.org#$#json-prune ad 'vinfo'",
                    expected: ["example.org#%#//scriptlet('abp-json-prune', 'ad', 'vinfo')"],
                },
                {
                    actual: "example.org#$#json-prune ad 'vinfo'; abort-on-property-write aoipwb",
                    expected: [
                        "example.org#%#//scriptlet('abp-json-prune', 'ad', 'vinfo')",
                        "example.org#%#//scriptlet('abp-abort-on-property-write', 'aoipwb')",
                    ],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });
        });

        describe('should convert redirect resources', () => {
            // Valid cases
            test.each([
                // should keep ADG redirect resources as is
                {
                    actual: '||example.com/banner$image,redirect=1x1-transparent.gif',
                    expected: ['||example.com/banner$image,redirect=1x1-transparent.gif'],
                    shouldConvert: false,
                },

                // should convert uBO redirect resource
                {
                    actual: '*$image,redirect-rule=1x1.gif,domain=seznamzpravy.cz',
                    expected: ['*$image,redirect-rule=1x1-transparent.gif,domain=seznamzpravy.cz'],
                },

                // should convert ABP redirect resource
                {
                    actual: '||example.com^$script,rewrite=abp-resource:blank-js',
                    expected: ['||example.com^$script,redirect=noopjs'],
                },

                // complex cases
                {
                    actual: '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices_gpt.js',
                    expected: ['||googletagservices.com/test.js$domain=test.com,redirect=googletagservices-gpt'],
                },
                {
                    actual: '||delivery.tf1.fr/pub$media,rewrite=abp-resource:blank-mp3,domain=tf1.fr',
                    expected: ['||delivery.tf1.fr/pub$media,redirect=noopmp3-0.1s,domain=tf1.fr'],
                },
            ])('should convert \'$actual\' to \'$expected\'', (testData) => {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            });

            // Invalid cases
            test.each([
                {
                    actual: 'example.com##^body > script:has-text(test)',
                    expected: "Unexpected token '<delim-token>' with value '>'",
                },
            ])("should throw error '$expected' on '$actual'", ({ actual, expected }) => {
                expect(() => RuleConverter.convertToAdg(RuleParser.parse(actual))).toThrowError(
                    new RuleConversionError(expected),
                );
            });
        });
    });
});
