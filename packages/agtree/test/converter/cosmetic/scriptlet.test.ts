import {
    describe,
    expect,
    it,
    test,
    vi,
} from 'vitest';

import { ScriptletRuleConverter } from '../../../src/converter/cosmetic/scriptlet';
import { type ScriptletInjectionRule } from '../../../src/nodes';
import { RuleParser } from '../../../src/parser-legacy/rule-parser';

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
            {
                actual: 'bokepgemoy.com##+js(nobab)',
                expected: [
                    "bokepgemoy.com#%#//scriptlet('ubo-nobab')",
                ],
            },
            {
                actual: "example.org##+js(prevent-canvas, '2d')",
                expected: [
                    "example.org#%#//scriptlet('ubo-prevent-canvas', '2d')",
                ],
            },
            // https://github.com/AdguardTeam/FiltersCompiler/issues/274
            {
                actual: 'example.org##+js(google-ima)',
                expected: [
                    "example.org#%#//scriptlet('ubo-google-ima')",
                ],
            },
            // https://github.com/AdguardTeam/FiltersCompiler/issues/274 (exception)
            {
                actual: 'example.org#@#+js(google-ima)',
                expected: [
                    "example.org#@%#//scriptlet('ubo-google-ima')",
                ],
            },
            // uBO's json-prune-fetch-response: propsToMatch is a key/value vararg, not positional.
            // https://github.com/AdguardTeam/FiltersCompiler/issues/250
            {
                // eslint-disable-next-line max-len
                actual: 'philo.com##+js(json-prune-fetch-response, periods.[-].eventStreams.0.id, , propsToMatch, /manifestv2)',
                expected: [
                    // eslint-disable-next-line max-len
                    "philo.com#%#//scriptlet('json-prune-fetch-response', 'periods.[-].eventStreams.0.id', '', '/manifestv2')",
                ],
                shouldConvert: true,
            },
            // json-prune-xhr-response: same key/value vararg remap.
            {
                // eslint-disable-next-line max-len
                actual: 'philo.com##+js(json-prune-xhr-response, periods.[-].eventStreams.0.id, , propsToMatch, /manifestv2)',
                expected: [
                    // eslint-disable-next-line max-len
                    "philo.com#%#//scriptlet('json-prune-xhr-response', 'periods.[-].eventStreams.0.id', '', '/manifestv2')",
                ],
                shouldConvert: true,
            },
            // both propsToMatch and stackToMatch as key/value pairs.
            {
                // eslint-disable-next-line max-len
                actual: 'example.com##+js(json-prune-fetch-response, a, b, propsToMatch, url:/foo, stackToMatch, /bar/)',
                expected: [
                    "example.com#%#//scriptlet('json-prune-fetch-response', 'a', 'b', 'url:/foo', '/bar/')",
                ],
                shouldConvert: true,
            },
            // only stackToMatch (no propsToMatch): empty propsToMatch placeholder before stack.
            {
                actual: 'example.com##+js(json-prune-fetch-response, a, b, stackToMatch, /bar/)',
                expected: [
                    "example.com#%#//scriptlet('json-prune-fetch-response', 'a', 'b', '', '/bar/')",
                ],
                shouldConvert: true,
            },
            // no varargs: native name, prune + needle only.
            {
                actual: 'example.com##+js(json-prune-fetch-response, a, b)',
                expected: [
                    "example.com#%#//scriptlet('json-prune-fetch-response', 'a', 'b')",
                ],
                shouldConvert: true,
            },
            // exception rule keeps exception status.
            {
                actual: 'example.com#@#+js(json-prune-fetch-response, a, b, propsToMatch, /x)',
                expected: [
                    "example.com#@%#//scriptlet('json-prune-fetch-response', 'a', 'b', '/x')",
                ],
                shouldConvert: true,
            },
            // unknown extra args are dropped: only recognized keys
            // (propsToMatch, stackToMatch) are remapped to positional slots.
            {
                // eslint-disable-next-line max-len
                actual: 'example.com##+js(json-prune-fetch-response, a, b, propsToMatch, /foo, unknownKey, /baz, stackToMatch, /bar/)',
                expected: [
                    "example.com#%#//scriptlet('json-prune-fetch-response', 'a', 'b', '/foo', '/bar/')",
                ],
                shouldConvert: true,
            },
            // repeated recognized keys: last value wins (last-value-wins semantics).
            {
                // eslint-disable-next-line max-len
                actual: 'example.com##+js(json-prune-fetch-response, a, b, propsToMatch, /first, propsToMatch, /second)',
                expected: [
                    "example.com#%#//scriptlet('json-prune-fetch-response', 'a', 'b', '/second')",
                ],
                shouldConvert: true,
            },
            // Single positional arg (no obligatoryProps, no varargs): the output
            // must not gain a trailing empty arg the source never had.
            // https://github.com/AdguardTeam/FiltersCompiler/issues/250
            {
                actual: 'example.com##+js(json-prune-fetch-response, a)',
                expected: [
                    "example.com#%#//scriptlet('json-prune-fetch-response', 'a')",
                ],
                shouldConvert: true,
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(ScriptletRuleConverter, 'convertToAdg');
        });

        it('warns when unknown extra args are dropped', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            // eslint-disable-next-line max-len
            const actual = 'example.com##+js(json-prune-fetch-response, a, b, propsToMatch, /foo, unknownKey, /baz)';

            ScriptletRuleConverter.convertToAdg(RuleParser.parse(actual) as ScriptletInjectionRule);

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknownKey'));
            warnSpy.mockRestore();
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
            {
                actual: "example.org#%#//scriptlet('prevent-canvas', '2d')",
                expected: [
                    "example.org#%#//scriptlet('prevent-canvas', '2d')",
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
                actual: "example.com#%#//scriptlet('prevent-fab-3.2.0')",
                expected: ['example.com##+js(nofab)'],
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
                actual: "example.com#%#//scriptlet('set-cookie', 'consent', 'true')",
                expected: ['example.com##+js(set-cookie, consent, true)'],
            },
            // https://github.com/AdguardTeam/Scriptlets/issues/404
            {
                actual: "example.com#%#//scriptlet('set-local-storage-item', 'mode', '$remove$')",
                expected: ['example.com##+js(set-local-storage-item, mode, $remove$)'],
            },
            // https://github.com/AdguardTeam/FiltersCompiler/issues/274
            {
                actual: "example.org#%#//scriptlet('google-ima3')",
                expected: [
                    'example.org##+js(google-ima)',
                ],
            },
            // https://github.com/AdguardTeam/FiltersCompiler/issues/274 (exception)
            {
                actual: "example.org#@%#//scriptlet('google-ima3')",
                expected: [
                    'example.org#@#+js(google-ima)',
                ],
            },
            // Should not convert already uBO scriptlet
            {
                actual: 'example.org##+js(google-ima)',
                expected: [
                    'example.org##+js(google-ima)',
                ],
                shouldConvert: false,
            },
            {
                actual: 'example.org##+js(googletagservices_gpt)',
                expected: [
                    'example.org##+js(googletagservices_gpt)',
                ],
                shouldConvert: false,
            },
            {
                actual: String.raw`example.net,example.com#$#set-cookie Hello\ no\ quotes true`,
                expected: [
                    String.raw`example.net,example.com##+js(set-cookie, Hello no quotes, true)`,
                ],
            },
            {
                actual: "[$domain=/^example\\d+\\.xyz/]#%#//scriptlet('set-constant', 'foo', 'bar')",
                expected: [
                    '/^example\\d+\\.xyz/##+js(set-constant, foo, bar)',
                ],
            },
            {
                // eslint-disable-next-line max-len
                actual: "[$domain=example.com|example.org]#%#//scriptlet('set-constant', 'form')",
                expected: [
                    'example.com,example.org##+js(set-constant, form)',
                ],
            },
            {
                // eslint-disable-next-line max-len
                actual: String.raw`[$domain=/^example\.org$/|somesite.org|somesite2.*]#%#//scriptlet('set-constant', 'form')`,
                expected: [
                    String.raw`/^example\.org$/,somesite.org,somesite2.*##+js(set-constant, form)`,
                ],
            },
            // https://github.com/AdguardTeam/FiltersCompiler/issues/260
            {
                actual: "aceee.org#%#//scriptlet('prevent-canvas', '2d')",
                expected: [
                    'aceee.org##+js(prevent-canvas, 2d)',
                ],
                shouldConvert: true,
            },
            // ADG positional propsToMatch/stack must round-trip back to uBO
            // key/value pairs, otherwise uBO drops them as unknown keys.
            // https://github.com/AdguardTeam/FiltersCompiler/issues/250
            {
                // eslint-disable-next-line max-len
                actual: "example.com#%#//scriptlet('json-prune-fetch-response', 'a', 'b', '/foo', '/bar/')",
                expected: [
                    'example.com##+js(json-prune-fetch-response, a, b, propsToMatch, /foo, stackToMatch, /bar/)',
                ],
                shouldConvert: true,
            },
            // only propsToMatch (no stack).
            {
                // eslint-disable-next-line max-len
                actual: "example.com#%#//scriptlet('json-prune-fetch-response', 'a', 'b', '/foo')",
                expected: [
                    'example.com##+js(json-prune-fetch-response, a, b, propsToMatch, /foo)',
                ],
                shouldConvert: true,
            },
            // only stack (empty propsToMatch placeholder): re-emit only stackToMatch.
            {
                // eslint-disable-next-line max-len
                actual: "example.com#%#//scriptlet('json-prune-fetch-response', 'a', 'b', '', '/bar/')",
                expected: [
                    'example.com##+js(json-prune-fetch-response, a, b, stackToMatch, /bar/)',
                ],
                shouldConvert: true,
            },
            // no propsToMatch/stack: preserved verbatim.
            {
                actual: "example.com#%#//scriptlet('json-prune-fetch-response', 'a', 'b')",
                expected: [
                    'example.com##+js(json-prune-fetch-response, a, b)',
                ],
                shouldConvert: true,
            },
            // single positional arg: preserved verbatim.
            {
                actual: "example.com#%#//scriptlet('json-prune-fetch-response', 'a')",
                expected: [
                    'example.com##+js(json-prune-fetch-response, a)',
                ],
                shouldConvert: true,
            },
            // xhr variant also remaps.
            {
                // eslint-disable-next-line max-len
                actual: "example.com#%#//scriptlet('json-prune-xhr-response', 'a', 'b', '/foo')",
                expected: [
                    'example.com##+js(json-prune-xhr-response, a, b, propsToMatch, /foo)',
                ],
                shouldConvert: true,
            },
        ])("should convert '$actual' to '$expected'", (testData) => {
            expect(testData).toBeConvertedProperly(ScriptletRuleConverter, 'convertToUbo');
        });
    });

    describe('should throw error on unsupported scriptlets in uBO', () => {
        test.each([
            {
                actual: String.raw`example.com#%#//scriptlet('inject-css-in-shadow-dom', '.block { display: none; }')`,
                expected: 'Scriptlet "inject-css-in-shadow-dom" is not supported in uBlock Origin.',
            },
            {
                actual: String.raw`example.com#%#//scriptlet('prevent-element-src-loading', 'img', '&adslot=')`,
                expected: 'Scriptlet "prevent-element-src-loading" is not supported in uBlock Origin.',
            },
            {
                actual: String.raw`example.com#%#//scriptlet('remove-in-shadow-dom', 'div[class^="bannerContainer"]')`,
                expected: 'Scriptlet "remove-in-shadow-dom" is not supported in uBlock Origin.',
            },
            {
                actual: String.raw`example.com#%#//scriptlet('hide-in-shadow-dom', '.ampAds')`,
                expected: 'Scriptlet "hide-in-shadow-dom" is not supported in uBlock Origin.',
            },
            {
                actual: String.raw`example.com#%#//scriptlet('trusted-set-local-storage-item', 'popupShow', '1')`,
                expected: 'Scriptlet "trusted-set-local-storage-item" is not supported in uBlock Origin.',
            },
            {
                actual: String.raw`example.com#%#//scriptlet('trusted-set-cookie', 'showCookie', 'true')`,
                expected: 'Scriptlet "trusted-set-cookie" is not supported in uBlock Origin.',
            },
            {
                // eslint-disable-next-line max-len
                actual: String.raw`example.org#%#//scriptlet('trusted-replace-argument', 'eval', '0', '"Replacement"', 'Foo bar')`,
                expected: 'Scriptlet "trusted-replace-argument" is not supported in uBlock Origin.',
            },
            {
                // eslint-disable-next-line max-len
                actual: String.raw`example.org#%#//scriptlet('trusted-replace-node-text', 'div', 'some', 'text', 'other text')`,
                expected: 'Scriptlet "trusted-replace-node-text" is not supported in uBlock Origin.',
            },
            {
                // eslint-disable-next-line max-len
                actual: String.raw`example.org#%#//scriptlet('trusted-suppress-native-method', 'Object.prototype.hasOwnProperty', '"test"')`,
                expected: 'Scriptlet "trusted-suppress-native-method" is not supported in uBlock Origin.',
            },
            {
                actual: String.raw`example.org#%#//scriptlet('trusted-dispatch-event', 'submit', '.test')`,
                expected: 'Scriptlet "trusted-dispatch-event" is not supported in uBlock Origin.',
            },
            {
                actual: String.raw`example.org#%#//scriptlet('trusted-replace-outbound-text', 'atob', 'foo', 'bar')`,
                expected: 'Scriptlet "trusted-replace-outbound-text" is not supported in uBlock Origin.',
            },
            {
                actual: String.raw`example.com#%#//scriptlet('trusted-set-constant', 'foo', 'bar')`,
                expected: 'Scriptlet "trusted-set-constant" is not supported in uBlock Origin.',
            },
            {
                actual: "[$path=/baz]example.com#%#//scriptlet('set-constant', 'foo', 'bar')",
                expected: 'uBlock Origin scriptlet injection rules do not support cosmetic rule modifiers.',
            },
            {
                actual: String.raw`[$path=/m]example.com#%#//scriptlet('trusted-click-element', 'form')`,
                expected: 'uBlock Origin scriptlet injection rules do not support cosmetic rule modifiers.',
            },
            {
                // eslint-disable-next-line max-len
                actual: "[$domain=example.com|~test.example.com,path=/page.html]#%#//scriptlet('trusted-click-element', 'form')",
                expected: 'uBlock Origin scriptlet injection rules do not support cosmetic rule modifiers.',
            },
            // non-valid domain syntax
            {
                // eslint-disable-next-line max-len
                actual: "[$domain=example.com| |example.org]#%#//scriptlet('set-constant', 'form')",
                expected: 'Empty value specified in the list',
            },
            {
                actual: "[$domain=|example.com|example.org]#%#//scriptlet('set-constant', 'form')",
                expected: 'Value list cannot start with a separator',
            },
            {
                // eslint-disable-next-line max-len
                actual: "[$domain=domain=exam[le.org|example.com|example,org|example or,]#%#//scriptlet('set-constant', 'form')",
                expected: 'Modifier name cannot be empty',
            },
        ])("should throw error on '$actual'", ({ actual, expected }) => {
            // eslint-disable-next-line max-len
            expect(() => ScriptletRuleConverter.convertToUbo(RuleParser.parse(actual) as ScriptletInjectionRule)).toThrowError(
                expected,
            );
        });
    });

    it('convertToAbp', () => {
        // TODO: We should implement this later
        expect(() => ScriptletRuleConverter.convertToAbp(
            RuleParser.parse('#%#//scriptlet(\'test\')') as ScriptletInjectionRule,
        )).toThrowError(
            'Not implemented',
        );
    });
});
