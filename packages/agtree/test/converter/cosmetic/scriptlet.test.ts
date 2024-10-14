import { RuleParser } from '../../../src/parser/rule';
import { ScriptletRuleConverter } from '../../../src/converter/cosmetic/scriptlet';
import { type ScriptletInjectionRule } from '../../../src/nodes';
import '../../matchers/check-conversion';

describe('Scriptlet conversion', () => {
    describe('ABP to ADG', () => {
        test.each([
            // single scriptlet
            {
                actual: '#$#abort-current-inline-script',
                expected: [
                    '#%#//scriptlet(\'abp-abort-current-inline-script\')',
                ],
                shouldConvert: true,
            },
            // exception status should be kept
            {
                actual: '#@$#abort-current-inline-script',
                expected: [
                    '#@%#//scriptlet(\'abp-abort-current-inline-script\')',
                ],
                shouldConvert: true,
            },
            // don't add prefix again if it's already there
            {
                actual: '#$#abp-abort-current-inline-script',
                expected: [
                    '#%#//scriptlet(\'abp-abort-current-inline-script\')',
                ],
                shouldConvert: true,
            },
            // single scriptlet with parameters
            {
                actual: '#$#override-property-read testProp false',
                expected: [
                    '#%#//scriptlet(\'abp-override-property-read\', \'testProp\', \'false\')',
                ],
                shouldConvert: true,
            },
            // redundant semicolon at the end of the rule
            {
                actual: '#$#override-property-read testProp false;',
                expected: [
                    '#%#//scriptlet(\'abp-override-property-read\', \'testProp\', \'false\')',
                ],
                shouldConvert: true,
            },
            // multiple scriptlets (ABP supports this, but ADG and uBO doesn't)
            {
                actual: '#$#log; abort-current-inline-script; override-property-read testProp false',
                expected: [
                    '#%#//scriptlet(\'abp-log\')',
                    '#%#//scriptlet(\'abp-abort-current-inline-script\')',
                    '#%#//scriptlet(\'abp-override-property-read\', \'testProp\', \'false\')',
                ],
                shouldConvert: true,
            },
            // Escaped separator
            // https://help.adblockplus.org/hc/en-us/articles/1500002338501-Snippet-filters-tutorial#h_01EXQ3RP7NBM57GBZE52QQ8T2N
            {
                actual: String.raw`example.net,example.com#$#log Hello\ no\ quotes`,
                expected: [
                    String.raw`example.net,example.com#%#//scriptlet('abp-log', 'Hello no quotes')`,
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(ScriptletRuleConverter, 'convertToAdg');
        });
    });

    describe('uBO to ADG', () => {
        test.each([
            // empty scriptlet
            {
                actual: 'example.org#@#+js()',
                expected: [
                    'example.org#@%#//scriptlet()',
                ],
                shouldConvert: true,
            },
            // regular scriptlet
            {
                actual: 'example.org##+js(aopr, foo)',
                expected: [
                    'example.org#%#//scriptlet(\'ubo-aopr\', \'foo\')',
                ],
                shouldConvert: true,
            },
            // exception status should be kept
            {
                actual: 'example.org#@#+js(aopr, foo)',
                expected: [
                    'example.org#@%#//scriptlet(\'ubo-aopr\', \'foo\')',
                ],
                shouldConvert: true,
            },
            // don't add prefix again if it's already there
            {
                actual: 'example.org##+js(ubo-aopr, foo)',
                expected: [
                    'example.org#%#//scriptlet(\'ubo-aopr\', \'foo\')',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.org##+js(abort-current-inline-script, $, popup)',
                expected: [
                    'example.org#%#//scriptlet(\'ubo-abort-current-inline-script\', \'$\', \'popup\')',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com##+js(remove-class, blur, , stay)',
                expected: [
                    "example.com#%#//scriptlet('ubo-remove-class', 'blur', '', 'stay')",
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`example.com##+js(spoof-css, .adsbygoogle\, #ads\, .adTest, visibility, visible)`,
                expected: [
                    // eslint-disable-next-line max-len
                    String.raw`example.com#%#//scriptlet('ubo-spoof-css', '.adsbygoogle, #ads, .adTest', 'visibility', 'visible')`,
                ],
            },
            {
                // specified selectors and applying for remove-attr/class
                actual: 'memo-book.pl##+js(rc, .locked, body\\, html, stay)',
                expected: [
                    "memo-book.pl#%#//scriptlet('ubo-rc', '.locked', 'body, html', 'stay')",
                ],
            },
            {
                // specified selectors and applying for remove-attr/class - one backslash
                // eslint-disable-next-line no-useless-escape
                actual: 'memo-book.pl##+js(rc, .locked, body\, html, stay)',
                expected: [
                    "memo-book.pl#%#//scriptlet('ubo-rc', '.locked', 'body, html', 'stay')",
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(ScriptletRuleConverter, 'convertToAdg');
        });
    });

    // leave ADG rules as is
    describe('ADG to ADG', () => {
        test.each([
            // empty exception scriptlet
            {
                actual: 'example.org#@%#//scriptlet()',
                expected: [
                    'example.org#@%#//scriptlet()',
                ],
                shouldConvert: false,
            },
            // regular scriptlet
            {
                actual: 'example.org#%#//scriptlet(\'abort-on-property-read\', \'foo\')',
                expected: [
                    'example.org#%#//scriptlet(\'abort-on-property-read\', \'foo\')',
                ],
                shouldConvert: false,
            },
            // leave quotes as is
            {
                actual: 'example.org#%#//scriptlet("abort-on-property-read", "foo")',
                expected: [
                    'example.org#%#//scriptlet("abort-on-property-read", "foo")',
                ],
                shouldConvert: false,
            },
            {
                actual: 'example.org#%#//scriptlet(\'abort-current-inline-script\', \'$\', \'popup\')',
                expected: [
                    'example.org#%#//scriptlet(\'abort-current-inline-script\', \'$\', \'popup\')',
                ],
                shouldConvert: false,
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(ScriptletRuleConverter, 'convertToAdg');
        });
    });

    // Tests migrated from:
    // https://github.com/AdguardTeam/Scriptlets/blob/d8d25ec625406faeaa5669627f143c7bad1a0328/tests/api/index.spec.js#L276-L374
    describe('convertToUbo', () => {
        test.each([
            {
                actual: 'example.org#@%#//scriptlet()',
                expected: ['example.org#@#+js()'],
                shouldConvert: true,
            },
            {
                actual: "example.org#%#//scriptlet('prevent-setTimeout', '[native code]', '8000')",
                expected: [
                    'example.org##+js(no-setTimeout-if, [native code], 8000)',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.org#%#//scriptlet(\'set-constant\', \'config.ads.desktopAd\', \'\')',
                expected: [
                    'example.org##+js(set-constant, config.ads.desktopAd, \'\')',
                ],
                shouldConvert: true,
            },
            {
                // eslint-disable-next-line max-len
                actual: 'example.org#%#//scriptlet(\'remove-class\', \'promo\', \'a.class, div#id, div > #ad > .test\')',
                expected: [
                    'example.org##+js(remove-class, promo, a.class\\, div#id\\, div > #ad > .test)',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.org#@%#//scriptlet(\'prevent-setTimeout\', \'[native code]\', \'8000\')',
                expected: ['example.org#@#+js(no-setTimeout-if, [native code], 8000)'],
            },
            {
                actual: 'example.org#%#//scriptlet("ubo-abort-on-property-read.js", "alert")',
                expected: ['example.org##+js(abort-on-property-read, alert)'],
            },
            {
                actual: 'example.com#%#//scriptlet("abp-abort-current-inline-script", "console.log", "Hello")',
                expected: ['example.com##+js(abort-current-script, console.log, Hello)'],
            },
            {
                actual: 'example.com#%#//scriptlet(\'prevent-fetch\', \'*\')',
                expected: ['example.com##+js(prevent-fetch, /^/)'],
            },
            {
                actual: 'example.com#%#//scriptlet(\'close-window\')',
                expected: ['example.com##+js(close-window)'],
            },
            {
                actual: "example.com#%#//scriptlet('set-cookie', 'CookieConsent', 'true')",
                expected: ['example.com##+js(set-cookie, CookieConsent, true)'],
            },
            {
                actual: "example.com#%#//scriptlet('set-local-storage-item', 'gdpr_popup', 'true')",
                expected: ['example.com##+js(set-local-storage-item, gdpr_popup, true)'],
            },
            {
                actual: "example.com#%#//scriptlet('set-session-storage-item', 'acceptCookies', 'false')",
                expected: ['example.com##+js(set-session-storage-item, acceptCookies, false)'],
            },
            {
                // emptyArr as set-constant parameter
                actual: "example.org#%#//scriptlet('set-constant', 'adUnits', 'emptyArr')",
                expected: ['example.org##+js(set-constant, adUnits, [])'],
            },
            {
                // emptyObj as set-constant parameter
                actual: "example.org#%#//scriptlet('set-constant', 'adUnits', 'emptyObj')",
                expected: ['example.org##+js(set-constant, adUnits, {})'],
            },
            {
                // Escapes commas in params
                actual: String.raw`example.com#%#//scriptlet('adjust-setInterval', ',dataType:_', '1000', '0.02')`,
                expected: [String.raw`example.com##+js(adjust-setInterval, \,dataType:_, 1000, 0.02)`],
            },
            {
                actual: "example.com#%#//scriptlet('spoof-css', '.advert', 'display', 'block')",
                expected: ['example.com##+js(spoof-css, .advert, display, block)'],
            },
            {
                // eslint-disable-next-line max-len
                actual: "example.com#%#//scriptlet('spoof-css', '.adsbygoogle, #ads, .adTest', 'visibility', 'visible')",
                expected: ['example.com##+js(spoof-css, .adsbygoogle\\, #ads\\, .adTest, visibility, visible)'],
            },
            {
                actual: "example.com#%#//scriptlet('set-cookie-reload', 'consent', 'true')",
                expected: ['example.com##+js(set-cookie-reload, consent, true)'],
            },
            // https://github.com/AdguardTeam/Scriptlets/issues/404
            {
                actual: "example.com#%#//scriptlet('set-local-storage-item', 'mode', '$remove$')",
                expected: ['example.com##+js(set-local-storage-item, mode, $remove$)'],
            },

            {
                actual: String.raw`example.net,example.com#$#log Hello\ no\ quotes`,
                expected: [
                    String.raw`example.net,example.com##+js(log, Hello no quotes)`,
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(ScriptletRuleConverter, 'convertToUbo');
        });
    });

    describe('convertToAbp', () => {
        // TODO: We should implement this later
        expect(() => ScriptletRuleConverter.convertToAbp(
            RuleParser.parse('#%#//scriptlet(\'test\')') as ScriptletInjectionRule,
        )).toThrowError(
            'Not implemented',
        );
    });
});
