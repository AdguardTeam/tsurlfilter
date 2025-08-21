/* eslint-disable max-len */
import {
    afterAll,
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { HTTPMethod } from '../../src/modifiers/method-modifier';
import { StealthOptionName } from '../../src/modifiers/stealth-modifier';
import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';
import { type NetworkRule, NetworkRuleGroupOptions, NetworkRuleOption } from '../../src/rules/network-rule';
import { createNetworkRule } from '../helpers/rule-creator';

describe('NetworkRule constructor', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        vi.resetAllMocks();
    });

    describe('creation of rule with $stealth modifier', () => {
        it('creates $stealth rule without options', () => {
            const rule = createNetworkRule('@@||example.org^$stealth', -1);
            expect(rule).toBeTruthy();
            const stealthModifier = rule.getStealthModifier();
            expect(stealthModifier?.hasValues()).toBeFalsy();
        });

        it('creates $stealth rule with valid options', () => {
            const rule = createNetworkRule('@@||example.org^$stealth=donottrack|xclientdata', -1);
            expect(rule).toBeTruthy();

            const stealthModifier = rule.getStealthModifier();
            expect(stealthModifier?.hasValues()).toBeTruthy();
            expect(stealthModifier?.hasStealthOption(StealthOptionName.DoNotTrack)).toBeTruthy();
            expect(stealthModifier?.hasStealthOption(StealthOptionName.XClientData)).toBeTruthy();
        });

        it('throws error on $stealth rule with inverted options', () => {
            expect(() => {
                createNetworkRule('@@||example.org^$stealth=~referrer|xclientdata', 0);
            }).toThrowError('Inverted $stealth modifier values are not allowed:');
        });

        it('does not throw error on $stealth modifier with partially supported values', () => {
            const rule = createNetworkRule('@@||example.org^$stealth=referrer|webrtc|location', 0);
            const stealthModifier = rule.getStealthModifier();
            expect(stealthModifier?.hasStealthOption(StealthOptionName.HideReferrer)).toBeTruthy();
            expect(stealthModifier?.hasStealthOption('webrtc' as StealthOptionName)).toBeFalsy();
            expect(stealthModifier?.hasStealthOption('location' as StealthOptionName)).toBeFalsy();
        });
    });

    it('works when it creates simple rules properly', () => {
        const rule = createNetworkRule('||example.org^', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getPattern()).toEqual('||example.org^');
        expect(rule.isAllowlist()).toEqual(false);
        expect(rule.getShortcut()).toEqual('example.org');
        expect(rule.isRegexRule()).toEqual(false);
        expect(rule.getPermittedDomains()).toEqual(null);
        expect(rule.getRestrictedDomains()).toEqual(null);
        expect(rule.isGeneric()).toEqual(true);
    });

    it('works when it creates rule with $all', () => {
        const rule = createNetworkRule('||example.org^$all', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getPattern()).toEqual('||example.org^');
        expect(rule.getPermittedRequestTypes()).toEqual(
            Object.values(RequestType).reduce((acc, val) => acc | val, 0 as number),
        );
        expect(rule.isAllowlist()).toEqual(false);
        expect(rule.getShortcut()).toEqual('example.org');
        expect(rule.isRegexRule()).toEqual(false);
        expect(rule.getPermittedDomains()).toEqual(null);
        expect(rule.getRestrictedDomains()).toEqual(null);
        expect(rule.isGeneric()).toEqual(true);
    });

    it('handles unknown modifiers properly', () => {
        const unknownModifier = 'unknown';
        expect(() => {
            createNetworkRule(`||example.org^$${unknownModifier}`, 0);
        }).toThrow(new SyntaxError(`Unknown modifier: ${unknownModifier}`));
    });

    it('handles negatable modifiers properly', () => {
        // Allow negation for negatable modifiers
        expect(() => {
            createNetworkRule('||example.org^$~third-party', 0);
        }).not.toThrow();

        // Do not allow negation for non-negatable modifiers
        expect(() => {
            createNetworkRule('||example.org^$~important', 0);
        }).toThrow(new SyntaxError("Invalid modifier: 'important' cannot be negated"));
    });

    it('throws error if allowlist-only modifier used in blacklist rule - $generichide', () => {
        expect(() => {
            createNetworkRule('||example.org^$generichide', 0);
        }).toThrow('cannot be used in blacklist rule');
    });

    it('throws error if allowlist-only modifier used in blacklist rule - $specifichide', () => {
        expect(() => {
            createNetworkRule('||example.org^$specifichide', 0);
        }).toThrow('cannot be used in blacklist rule');
    });

    it('throws error if allowlist-only modifier used in blacklist rule - $elemhide', () => {
        expect(() => {
            createNetworkRule('||example.org^$elemhide', 0);
        }).toThrowError('cannot be used in blacklist rule');
    });

    it('throws error if blacklist-only modifiers used in allowlist rule - $all', () => {
        expect(() => {
            createNetworkRule('@@||example.org^$all', 0);
        }).toThrowError('Rule with $all modifier can not be allowlist rule');
    });

    it('construct $domain rules with regexp values', () => {
        let rule: NetworkRule;
        rule = createNetworkRule(String.raw`||example.org$domain=/example\.(org\|com)/|evil.com`, 0);
        expect(rule.getPermittedDomains()).toEqual([String.raw`/example\.(org|com)/`, 'evil.com']);
        expect(rule.getRestrictedDomains()).toEqual(null);

        rule = createNetworkRule(String.raw`||example.org$domain=~/good\.evil\.(com\|org)/|/evil\.com/`, 0);
        expect(rule.getPermittedDomains()).toEqual([String.raw`/evil\.com/`]);
        expect(rule.getRestrictedDomains()).toEqual([String.raw`/good\.evil\.(com|org)/`]);
    });

    it('works when it handles empty $domain modifier', () => {
        expect(() => {
            createNetworkRule('||example.org^$domain=', 0);
        }).toThrow(new Error('Modifier value cannot be empty'));
    });

    it('works when it handles empty domain inside a $domain modifier', () => {
        expect(() => {
            createNetworkRule('||example.org^$domain=example.com|', 0);
        }).toThrow('Value list cannot end with a separator');
    });

    it('throws error if host rule is provided', () => {
        expect(() => {
            const hostRule = '209.237.226.90  www.opensource.org';
            createNetworkRule(hostRule, 0);
        }).toThrow(new SyntaxError('Rule has spaces, seems to be an host rule'));
    });

    it('works when it handles too wide rules properly', () => {
        expect(() => {
            createNetworkRule('||*', 0);
        }).toThrow(new SyntaxError('Rule is too general: ||*'));
    });

    it('doesnt consider rules with app modifier too wide', () => {
        const rule = createNetworkRule('@@*$app=com.cinemark.mobile', 0);
        expect(rule).toBeTruthy();
    });

    it('handles restricted apps', () => {
        const rule = createNetworkRule('||baddomain.com^$app=org.good.app|~org.bad.app', 0);
        expect(rule.getRestrictedApps()).toContain('org.bad.app');
        expect(rule.getPermittedApps()).toContain('org.good.app');
    });

    it('throws error if app modifier is empty', () => {
        expect(() => {
            createNetworkRule('||baddomain.com^$app', 0);
        }).toThrow(new SyntaxError('$app modifier cannot be empty'));
    });

    it('throws error if $header modifier value is invalid', () => {
        expect(() => {
            createNetworkRule('||baddomain.com^$header', 0);
        }).toThrow(new SyntaxError('$header modifier value cannot be empty'));

        expect(() => {
            createNetworkRule('||baddomain.com^$header=name:', 0);
        }).toThrow(new SyntaxError('Invalid $header modifier value: "name:"'));
    });

    it('validates $header rules modifier compatibility', () => {
        // Check compatibility with other modifiers
        expect(() => {
            createNetworkRule(String.raw`||baddomain.com^$header=h1,csp=frame-src 'none'`, 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||baddomain.com^$header=h1,removeheader=param', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||baddomain.com^$header=h1,script', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||baddomain.com^$header=h1,document', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||baddomain.com^$header=h1,third-party', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||baddomain.com^$header=h1,match-case', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||baddomain.com^$header=h1,domain=example.org', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||baddomain.com^$header=h1,removeheader=request:param', 0);
        }).toThrow(new SyntaxError('Request headers removal of $removeheaders is not compatible with $header rules.'));

        expect(() => {
            createNetworkRule('||baddomain.com^$header=h1,hls=urlpattern', 0);
        }).toThrow('$header rules are not compatible with some other modifiers');
    });

    it('throws error if $method modifier value is invalid', () => {
        expect(() => {
            createNetworkRule('||baddomain.com^$method=get', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||baddomain.com^$method=', 0);
        }).toThrow(new SyntaxError('Modifier value cannot be empty'));

        expect(() => {
            createNetworkRule('||baddomain.com^$method=invalid', 0);
        }).toThrow(new SyntaxError('Invalid $method modifier value: INVALID'));

        expect(() => {
            createNetworkRule('||baddomain.com^$method=get|~post', 0);
        }).toThrow(new SyntaxError('Negated values cannot be mixed with non-negated values: get|~post'));
    });

    it('throws error if $to modifier value is invalid', () => {
        expect(() => {
            createNetworkRule('/ads$to=example.org|~example.com', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||*/ads^$to=evil.com', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('||baddomain.com^$to=', 0);
        }).toThrow(new SyntaxError('Modifier value cannot be empty'));

        expect(() => {
            createNetworkRule('||baddomain.com^$to=example.org|', 0);
        }).toThrow(new SyntaxError('Empty domain specified in "example.org|"'));
    });

    it('throws error if $permissions modifier value is invalid', () => {
        expect(() => {
            createNetworkRule(String.raw`||example.org$permissions=permissions=oversized-images=()\,clipboard-read=(self)`, 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule(String.raw`@@||example.org$permissions`, 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule(String.raw`@@||example.org$permissions=geolocation=*`, 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule(String.raw`||example.org$permissions`, 0);
        }).toThrow(new SyntaxError('Invalid $permissions rule: permissions directive must not be empty'));

        // Must throw on unsupported modifiers
        expect(() => {
            createNetworkRule(String.raw`||example.org$match-case,permissions=geolocation=(self)`, 0);
        }).toThrow(new SyntaxError('$permissions rules are not compatible with some other modifiers'));

        expect(() => {
            createNetworkRule(String.raw`||example.org$important,permissions=geolocation=(self)`, 0);
        }).not.toThrow();
    });

    it('allows and converts pipe separator in $permissions modifier values', () => {
        const rule = createNetworkRule('||example.org$permissions=permissions=oversized-images=()|clipboard-read=(self)', 0);
        const expectedValue = 'permissions=oversized-images=(),clipboard-read=(self)';
        expect(rule.getAdvancedModifierValue()).toBe(expectedValue);
    });

    it('thorws error if $to modifier value is invalid', () => {
        expect(() => {
            createNetworkRule('||*/ads^$to=evil.com', 0);
        }).not.toThrow();

        expect(() => {
            createNetworkRule('|*/ads^$to=', 0);
        }).toThrow(new SyntaxError('Modifier value cannot be empty'));

        expect(() => {
            createNetworkRule('|*/ads^$to=evil.com|', 0);
        }).toThrow(new SyntaxError('Empty domain specified in "evil.com|"'));
    });

    it('checks removeparam modifier compatibility', () => {
        let correct = createNetworkRule('||example.org^$removeparam=p,domain=test.com,third-party,match-case', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$removeparam=p,domain=test.com,third-party,important,match-case', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$removeparam', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$removeparam=p,object', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$removeparam=p,~object', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$removeparam=p,media', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('@@||example.org^$removeparam=p,badfilter', 0);
        expect(correct).toBeTruthy();

        expect(() => {
            createNetworkRule('@@||example.org^$removeparam=p,document', 0);
        }).toThrow(new SyntaxError('$removeparam rules are not compatible with some other modifiers'));

        expect(() => {
            createNetworkRule('||example.org^$removeparam=p,domain=test.com,popup', 0);
        }).toThrow(new SyntaxError('$removeparam rules are not compatible with some other modifiers'));
    });

    it('checks removeheader modifier compatibility', () => {
        let correct = createNetworkRule('||example.org^$removeheader=header-name', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$removeheader=header-name,domain=test.com,third-party,important,match-case', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('@@||example.org^$removeheader', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$removeheader=header-name,object', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$removeheader=header-name,~object', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$removeheader=header-name,media', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('@@||example.org^$removeheader=header-name,badfilter', 0);
        expect(correct).toBeTruthy();

        expect(() => {
            createNetworkRule('@@||example.org^$removeheader=header-name,document', 0);
        }).toThrow(new SyntaxError('$removeheader rules are not compatible with some other modifiers'));

        expect(() => {
            createNetworkRule('||example.org^$removeheader=header-name,domain=test.com,popup', 0);
        }).toThrow(new SyntaxError('$removeheader rules are not compatible with some other modifiers'));

        expect(() => {
            createNetworkRule('||baddomain.com^$header=h1,removeheader=request:param', 0);
        }).toThrow(new SyntaxError('Request headers removal of $removeheaders is not compatible with $header rules.'));
    });

    it('checks jsonprune modifier compatibility', () => {
        let correct;

        correct = createNetworkRule('||example.org/*/*/$xmlhttprequest,jsonprune=\\$..[ac\\, ab]', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org/*/*/$jsonprune=\\$..[ac\\, ab],xmlhttprequest', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org/*/*/$xmlhttprequest,jsonprune=\\$.data.*.attributes', 0);
        expect(correct).toBeTruthy();

        // TODO: add more specific jsonprune tests during the implementation
        // https://github.com/AdguardTeam/tsurlfilter/issues/71
    });

    it('checks hls modifier compatibility', () => {
        let correct;

        correct = createNetworkRule('||example.org^$hls=preroll', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$hls=\\/videoplayback^?*&source=dclk_video_ads', 0);
        expect(correct).toBeTruthy();

        correct = createNetworkRule('||example.org^$hls=/#UPLYNK-SEGMENT:.*\\,ad/t', 0);
        expect(correct).toBeTruthy();

        // TODO: add more specific jsonprune tests during the implementation
        // https://github.com/AdguardTeam/tsurlfilter/issues/72
    });

    it('checks to modifier compatibility', () => {
        expect(() => {
            createNetworkRule('/ads$to=good.org,denyallow=good.com', 0);
        }).toThrow(new SyntaxError('modifier $to is not compatible with $denyallow modifier'));
    });

    it('checks denyallow modifier compatibility', () => {
        expect(() => {
            createNetworkRule('/ads$to=good.org,denyallow=good.com', 0);
        }).toThrow(new SyntaxError('modifier $to is not compatible with $denyallow modifier'));
    });

    it('works when it handles wide rules with $domain properly', () => {
        const rule = createNetworkRule('$domain=ya.ru', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getPattern()).toEqual('');
        expect(rule.getPermittedDomains()).toEqual(['ya.ru']);
    });

    it('checks $all modifier compatibility', () => {
        const correct = createNetworkRule('||example.org^$all', 0);
        expect(correct).toBeTruthy();
    });

    it('works when it handles $all modifier', () => {
        const rule = createNetworkRule('||example.com^$all', 0);
        expect(rule.getFilterListId()).toEqual(0);

        expect(rule.getPermittedRequestTypes()).toEqual(
            Object.values(RequestType).reduce((acc, val) => acc | val, 0 as number),
        );
    });

    /**
     * Checks if a network rule modifier is enabled or disabled.
     *
     * @param name The name of the modifier.
     * @param option The network rule option.
     * @param enabled Whether the modifier should be enabled.
     * @param allowlist Whether the rule is an allowlist rule.
     */
    function checkModifier(name: string, option: NetworkRuleOption, enabled: boolean, allowlist = false): void {
        let ruleText = `||example.org^$${name}`;
        if (allowlist || (option & NetworkRuleGroupOptions.AllowlistOnly) === option) {
            ruleText = `@@${ruleText}`;
        }

        const rule = createNetworkRule(ruleText, 0);
        if (enabled) {
            expect(rule.isOptionEnabled(option)).toEqual(true);
            expect(rule.isOptionDisabled(option)).toEqual(false);
        } else {
            expect(rule.isOptionDisabled(option)).toEqual(true);
            expect(rule.isOptionEnabled(option)).toEqual(false);
        }
    }

    it('works when modifiers are parsed properly', () => {
        checkModifier('important', NetworkRuleOption.Important, true);
        checkModifier('third-party', NetworkRuleOption.ThirdParty, true);
        checkModifier('~first-party', NetworkRuleOption.ThirdParty, true);
        checkModifier('first-party', NetworkRuleOption.ThirdParty, false);
        checkModifier('~third-party', NetworkRuleOption.ThirdParty, false);
        checkModifier('match-case', NetworkRuleOption.MatchCase, true);
        checkModifier('~match-case', NetworkRuleOption.MatchCase, false);

        checkModifier('elemhide', NetworkRuleOption.Elemhide, true);
        checkModifier('generichide', NetworkRuleOption.Generichide, true);
        checkModifier('genericblock', NetworkRuleOption.Genericblock, true);
        checkModifier('jsinject', NetworkRuleOption.Jsinject, true);
        checkModifier('urlblock', NetworkRuleOption.Urlblock, true);
        checkModifier('content', NetworkRuleOption.Content, true);

        checkModifier('document', NetworkRuleOption.Elemhide, true);
        checkModifier('document', NetworkRuleOption.Jsinject, true);
        checkModifier('document', NetworkRuleOption.Urlblock, true);
        checkModifier('document', NetworkRuleOption.Content, true);

        checkModifier('document', NetworkRuleOption.Elemhide, true, true);
        checkModifier('document', NetworkRuleOption.Jsinject, true, true);
        checkModifier('document', NetworkRuleOption.Urlblock, true, true);
        checkModifier('document', NetworkRuleOption.Content, true, true);

        checkModifier('stealth', NetworkRuleOption.Stealth, true);
        checkModifier('badfilter', NetworkRuleOption.Badfilter, true);

        checkModifier('popup', NetworkRuleOption.Popup, true);
        checkModifier('popup', NetworkRuleOption.Popup, true, true);

        checkModifier('extension', NetworkRuleOption.Extension, true);
        checkModifier('~extension', NetworkRuleOption.Extension, false);

        checkModifier('network', NetworkRuleOption.Network, true);

        checkModifier('all', NetworkRuleOption.Popup, true);
    });

    /**
     * Checks if a network rule matches the given request type.
     *
     * @param name The name of the request type.
     * @param requestType The request type to check.
     * @param permitted Whether the request type should be permitted.
     */
    function checkRequestType(name: string, requestType: RequestType, permitted: boolean): void {
        const rule = createNetworkRule(`||example.org^$${name}`, 0);
        if (permitted) {
            expect(rule.getPermittedRequestTypes()).toEqual(requestType);
            expect(rule.getRestrictedRequestTypes()).toEqual(RequestType.NotSet);
        } else {
            expect(rule.getRestrictedRequestTypes()).toEqual(requestType);
            expect(rule.getPermittedRequestTypes()).toEqual(RequestType.NotSet);
        }
    }

    it('works when type modifiers are parsed properly', () => {
        checkRequestType('script', RequestType.Script, true);
        checkRequestType('~script', RequestType.Script, false);

        checkRequestType('stylesheet', RequestType.Stylesheet, true);
        checkRequestType('~stylesheet', RequestType.Stylesheet, false);

        checkRequestType('subdocument', RequestType.SubDocument, true);
        checkRequestType('~subdocument', RequestType.SubDocument, false);

        checkRequestType('object', RequestType.Object, true);
        checkRequestType('~object', RequestType.Object, false);

        checkRequestType('image', RequestType.Image, true);
        checkRequestType('~image', RequestType.Image, false);

        checkRequestType('xmlhttprequest', RequestType.XmlHttpRequest, true);
        checkRequestType('~xmlhttprequest', RequestType.XmlHttpRequest, false);

        checkRequestType('media', RequestType.Media, true);
        checkRequestType('~media', RequestType.Media, false);

        checkRequestType('font', RequestType.Font, true);
        checkRequestType('~font', RequestType.Font, false);

        checkRequestType('websocket', RequestType.WebSocket, true);
        checkRequestType('~websocket', RequestType.WebSocket, false);

        checkRequestType('other', RequestType.Other, true);
        checkRequestType('~other', RequestType.Other, false);

        checkRequestType('ping', RequestType.Ping, true);
        checkRequestType('~ping', RequestType.Ping, false);

        checkRequestType('document', RequestType.Document, true);
        checkRequestType('~document', RequestType.Document, false);

        const rule = createNetworkRule('||example.org^$all', 0);
        const allRequestTypes = Object.values(RequestType)
            .reduce((prevValue: number, curValue: number) => {
                return prevValue | curValue;
            }, RequestType.Document);
        expect(rule.getPermittedRequestTypes()).toEqual(allRequestTypes);
        expect(rule.getRestrictedRequestTypes()).toEqual(RequestType.NotSet);
    });

    /**
     * Checks whether the badfilter modifier negates the given rule.
     *
     * @param rule Rule to negate.
     * @param badfilter Badfilter rule.
     * @param expected Expected result.
     */
    function assertBadfilterNegates(rule: string, badfilter: string, expected: boolean): void {
        const r = createNetworkRule(rule, -1);
        expect(r).toBeTruthy();

        const b = createNetworkRule(badfilter, -1);
        expect(b).toBeTruthy();

        expect(b.negatesBadfilter(r)).toEqual(expected);
    }

    it('works if badfilter modifier works properly', () => {
        assertBadfilterNegates('*$image,domain=example.org', '*$image,domain=example.org,badfilter', true);
        assertBadfilterNegates('*$image,domain=example.org', '*$image,domain=example.org', false);
        assertBadfilterNegates('*$~third-party,domain=example.org', '*$domain=example.org,badfilter', false);
        assertBadfilterNegates('*$image,domain=example.org', '*$domain=example.org,badfilter', false);
        assertBadfilterNegates('*$image,domain=example.org', '*$image,badfilter,domain=example.org', true);
        assertBadfilterNegates('@@*$image,domain=example.org', '@@*$image,domain=example.org,badfilter', true);
        assertBadfilterNegates('@@*$image,domain=example.org', '*$image,domain=example.org,badfilter', false);

        assertBadfilterNegates('@@path$image,domain=~example.org', '@@path$image,domain=~example.org,badfilter', true);
        assertBadfilterNegates('@@path$image,domain=~example.org', '@@path$image,domain=~example.com,badfilter', false);
        assertBadfilterNegates('@@path$image,domain=~example.org', '@@an-other-path$image,domain=~example.org,badfilter', false);
        assertBadfilterNegates('@@path$image,domain=~example.org|~example.com', '@@path$image,domain=~example.org,badfilter', false);

        assertBadfilterNegates('*$~image,domain=example.org', '*$~script,domain=example.org,badfilter', false);
        assertBadfilterNegates('*$image,domain=example.org|example.com', '*$image,domain=example.org,badfilter', true);
        assertBadfilterNegates('*$image,domain=example.com', '*$image,domain=example.org,badfilter', false);
        assertBadfilterNegates('*$image,domain=example.org|~example.com', '*$image,domain=example.org,badfilter', false);
    });

    it('works if noop modifier works properly', () => {
        let rule = createNetworkRule('||example.com$_', -1);
        expect(rule).toBeTruthy();

        rule = createNetworkRule('||example.com$_,replace=/bad/good/,____,image', -1);
        expect(rule).toBeTruthy();

        expect(() => {
            createNetworkRule('||example.com$_invalid_,replace=/bad/good/,____,image', -1);
        }).toThrow('Unknown modifier: _invalid_');
    });

    it('works if denyallow modifier works properly', () => {
        const rule = createNetworkRule('/some.png$denyallow=example.ru|example.uk', -1);
        expect(rule).toBeTruthy();

        // Domains in the modifier's parameter cannot be negated ($denyallow=~x.com)
        expect(() => {
            createNetworkRule('/some$denyallow=example.com|~example.org,domain=example.com', -1);
        }).toThrow('Invalid modifier: $denyallow domains cannot be negated');

        // or have a wildcard TLD ($denyallow=x.*)
        expect(() => {
            createNetworkRule('/some$denyallow=example.*,domain=example.com', -1);
        }).toThrow('Invalid modifier: $denyallow does not support wildcards and regex domains');

        // or have a regex value ($denyallow=/(x\|y)/)
        expect(() => {
            createNetworkRule('/some$denyallow=/domainname/,domain=example.com', -1);
        }).toThrow('Invalid modifier: $denyallow does not support wildcards and regex domains');
    });

    it('works if document modifier works properly', () => {
        let rule = createNetworkRule('||example.org^$document', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = createNetworkRule('@@||example.org^$document', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = createNetworkRule('||example.org^$document,script', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document | RequestType.Script);

        rule = createNetworkRule('||example.org^$document,popup', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = createNetworkRule('||example.org^$document,replace=/test/test2/', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = createNetworkRule('||example.org^$document,removeparam=p', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = createNetworkRule('||example.org^$~document', -1);
        expect(rule).toBeTruthy();
        expect(rule.getRestrictedRequestTypes()).toEqual(RequestType.Document);
    });

    it('works if all modifier works properly', () => {
        const rule = createNetworkRule('||example.org^$all', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Popup));
        const allRequestTypes = Object.values(RequestType)
            .reduce((prevValue: number, curValue: number) => {
                return prevValue | curValue;
            }, RequestType.Document);
        expect(rule.getPermittedRequestTypes()).toEqual(allRequestTypes);
    });

    it('works if doc modifier alias works properly', () => {
        let rule = createNetworkRule('||example.org^$doc', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = createNetworkRule('||example.org^$~doc', -1);
        expect(rule).toBeTruthy();
        expect(rule.getRestrictedRequestTypes()).toEqual(RequestType.Document);
    });

    it('works if popup modifier works properly with other request type modifiers', () => {
        let rule = createNetworkRule('||example.org^$popup', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Popup));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.NotSet);

        rule = createNetworkRule('||example.org^$script,image,popup', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Popup));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Script | RequestType.Image);
    });
});

describe('NetworkRule.match', () => {
    it('works when it matches simple rules properly', () => {
        const rule = createNetworkRule('||example.org^', 0);
        const request = new Request('https://example.org/', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when it matches regex rules properly', () => {
        const rule = createNetworkRule('/example\\.org/', 0);
        const request = new Request('https://example.org/', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $match-case is applied properly', () => {
        // Rule's url has upper case characters
        let rule = createNetworkRule('||example.org/PATH$match-case', 0);
        let request = new Request('https://example.org/path', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        rule = createNetworkRule('||example.org/PATH$match-case', 0);
        request = new Request('https://example.org/PATH', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        // Rule's url have upper case characters
        rule = createNetworkRule('||example.org/path$match-case', 0);
        request = new Request('https://example.org/PATH', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        rule = createNetworkRule('||example.org/path$match-case', 0);
        request = new Request('https://example.org/path', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        // Rule's short url has upper case characters
        rule = createNetworkRule('/FILE.js$match-case', 0);
        request = new Request('https://example.org/file.js', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        rule = createNetworkRule('/FILE.js$match-case', 0);
        request = new Request('https://example.org/FILE.js', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        // Rule's short url doesn't have upper case characters
        rule = createNetworkRule('/file.js$match-case', 0);
        request = new Request('https://example.org/FILE.js', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        rule = createNetworkRule('/file.js$match-case', 0);
        request = new Request('https://example.org/file.js', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $third-party modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = createNetworkRule('||example.org^$third-party', 0);

        // First-party 1
        request = new Request('https://example.org/', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        // First-party 2
        request = new Request('https://sub.example.org/', 'https://example.org/', RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        // Third-party
        request = new Request('https://example.org/', 'https://example.com', RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        rule = createNetworkRule('||example.org^$first-party', 0);

        // First-party 1
        request = new Request('https://example.org/', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        // First-party 2
        request = new Request('https://sub.example.org/', 'https://example.org/', RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        // Third-party
        request = new Request('https://example.org/', 'https://example.com', RequestType.Other);
        expect(rule.match(request)).toEqual(false);
    });

    it('works when $domain modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        // Just one permitted domain
        rule = createNetworkRule('||example.org^$domain=example.org', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', 'https://subdomain.example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        // One permitted, subdomain restricted
        rule = createNetworkRule('||example.org^$domain=example.org|~subdomain.example.org', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', 'https://subdomain.example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        // One restricted
        rule = createNetworkRule('||example.org^$domain=~example.org', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', 'https://subdomain.example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(false);
    });

    describe('$domain modifier semantics', () => {
        it('matches target domain only if rule has excluded domains', () => {
            let request;
            let rule;

            // rule only with excluded domains
            rule = createNetworkRule('||example.*^$domain=~example.org|~example.com', 0);

            request = new Request('https://example.org', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();

            request = new Request('https://example.com', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();

            request = new Request('https://example.eu', null, RequestType.Document);
            expect(rule.match(request)).toBeTruthy();

            // rule with permitted and excluded domains
            rule = createNetworkRule('||example.*^$domain=example.org|~example.com', 0);

            request = new Request('https://example.org', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();

            request = new Request('https://example.com', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();

            request = new Request('https://example.com', 'https://example.org', RequestType.Document);
            expect(rule.match(request)).toBeTruthy();

            request = new Request('https://example.com', 'https://example.com', RequestType.Document);
            expect(rule.match(request)).toBeFalsy();
        });

        it('matches target domain only for document type requests', () => {
            let request;

            const rule = createNetworkRule('||example.*^$domain=~example.com', 0);

            request = new Request('https://example.com', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();

            request = new Request('https://example.com', null, RequestType.Script);
            expect(rule.match(request)).toBeTruthy();

            request = new Request('https://example.org', 'https://example.com', RequestType.Script);
            expect(rule.match(request)).toBeFalsy();
        });

        it('matches target domain if pattern is not domain specific and not regex', () => {
            let request;
            const rule = createNetworkRule('com$domain=example.com', 0);

            request = new Request('https://example.com', null, RequestType.Document);
            expect(rule.match(request)).toBeTruthy();

            request = new Request('https://example.org/com', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();
        });
    });

    it('works $removeparam modifier with content types logic', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = createNetworkRule('||example.org^$removeparam=p', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
        request = new Request('https://example.org/', null, RequestType.SubDocument);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        rule = createNetworkRule('||example.org^$removeparam=p,script', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(false);
        request = new Request('https://example.org/', null, RequestType.SubDocument);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        rule = createNetworkRule('||example.org^$removeparam=p,~script', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
        request = new Request('https://example.org/', null, RequestType.SubDocument);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(true);
    });

    it('works $permissions modifier with content types logic', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = createNetworkRule('||example.org^$permissions=accelerometer=()', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
        request = new Request('https://example.org/', null, RequestType.SubDocument);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        rule = createNetworkRule('||example.org^$permissions=accelerometer=(),script', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(false);
        request = new Request('https://example.org/', null, RequestType.SubDocument);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        rule = createNetworkRule('||example.org^$permissions=accelerometer=(),~script', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
        request = new Request('https://example.org/', null, RequestType.SubDocument);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $domain in uppercase', () => {
        const rule = createNetworkRule('$domain=ExaMple.com', 0);
        const request = new Request('https://example.com/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $denyallow modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = createNetworkRule('/some.png$denyallow=example.ru|example.uk', 0);
        request = new Request('https://example.ru/some.png', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.uk/some.png', 'https://example.org', RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.us/some.png', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.ua/some.png', 'https://example.org', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        // with $domain modifier
        rule = createNetworkRule('/some$domain=example.com|example.org,denyallow=example.ru|example.uk', 0);
        request = new Request('https://example.ru/some', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.uk/some', 'https://example.org', RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.us/some', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.ua/some', 'https://example.org', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        // exception rule
        rule = createNetworkRule('@@/some$domain=example.com,denyallow=example.org', 0);
        request = new Request('https://example.net/some', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/some', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(false);
    });

    it('works when $domain modifier is applied properly - hostname', () => {
        let rule: NetworkRule;
        let request: Request;

        // Wide rule
        rule = createNetworkRule('$domain=example.org', 0);
        request = new Request('https://example.com/', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        // Match request url host
        rule = createNetworkRule('$domain=example.org', 0);
        request = new Request('https://example.org/', 'https://example.com/', RequestType.Document);
        expect(rule.match(request)).toEqual(true);

        // Document or Subdocument only
        rule = createNetworkRule('$domain=example.org', 0);
        request = new Request('https://example.org/', 'https://example.com/', RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        // Not matching domain specific patterns
        rule = createNetworkRule('||example.org/path$domain=example.org', 0);
        request = new Request('https://example.org/path', 'https://example.com/', RequestType.Document);
        expect(rule.match(request)).toEqual(false);

        // Match any domain pattern
        rule = createNetworkRule('path$domain=example.org', 0);
        request = new Request('https://example.org/path', 'https://example.com/', RequestType.Document);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $domain modifier is applied properly - wildcards', () => {
        let request: Request;

        const rule = createNetworkRule('||test.ru/^$domain=~nigma.*|google.*,third-party,match-case,popup', 0);

        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getRestrictedDomains()).toHaveLength(1);

        request = new Request('https://test.ru/', 'https://google.com/', RequestType.Document);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://test.ru/', 'https://www.google.com/', RequestType.Document);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://test.ru/', 'https://www.google.de/', RequestType.Document);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://test.ru/', 'https://www.google.co.uk/', RequestType.Document);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://test.ru/', 'https://google.co.uk/', RequestType.Document);
        expect(rule.match(request)).toBeTruthy();

        // non-existent tld
        request = new Request('https://test.ru/', 'https://google.uk.eu/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request = new Request('https://test.ru/', 'https://nigma.ru/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request = new Request('https://test.ru/', 'https://nigma.com/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request = new Request('https://test.ru/', 'https://www.nigma.ru/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request = new Request('https://test.ru/', 'https://adguard.ru/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();
    });

    it('works when $domain modifier is applied properly - regexp', () => {
        let request: Request;
        const requestType: RequestType = RequestType.Script;

        const rule = createNetworkRule(String.raw`||test.ru^$domain=/\.(io\|com)/|~/good\.(org\|com)/`, 0);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getRestrictedDomains()).toHaveLength(1);

        request = new Request('https://test.ru/', 'https://example.com', requestType);
        expect(rule.match(request)).toBeTruthy();
        request = new Request('https://test.ru/', 'https://example.io', requestType);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://test.ru/', 'https://good.org', requestType);
        expect(rule.match(request)).toBeFalsy();
        request = new Request('https://test.ru/', 'https://good.com', requestType);
        expect(rule.match(request)).toBeFalsy();
    });

    it('matches by $domain modifier with mixed type values', () => {
        let request: Request;
        const requestType: RequestType = RequestType.Script;
        const rule = createNetworkRule(String.raw`||test.ru^$domain=/\.(io\|com)/|evil.*|ads.net|~/jwt\.io/|~evil.gov`, 0);
        expect(rule.getPermittedDomains()).toHaveLength(3);
        expect(rule.getRestrictedDomains()).toHaveLength(2);

        request = new Request('https://test.ru/', 'https://ads.net', requestType);
        expect(rule.match(request)).toBeTruthy();
        request = new Request('https://test.ru/', 'https://another.org', requestType);
        expect(rule.match(request)).toBeFalsy();

        // Inverted regexp domain '~/jwt\.io/' restricts
        // regexp domain modifier '/\.(io\|com)/' from matching the request
        request = new Request('https://test.ru/', 'https://example.com', requestType);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://test.ru/', 'https://jwt.io', requestType);
        expect(rule.match(request)).toBeFalsy();

        // Inverted plain domain '~evil.gov' restricts
        // wildcard domain modifier 'evil.*' from matching the request
        request = new Request('https://test.ru/', 'https://evil.org', requestType);
        expect(rule.match(request)).toBeTruthy();
        request = new Request('https://test.ru/', 'https://evil.com', requestType);
        expect(rule.match(request)).toBeTruthy();
        request = new Request('https://test.ru/', 'https://evil.gov', requestType);
        expect(rule.match(request)).toBeFalsy();
    });

    it('works when content type restrictions are applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        // $script
        rule = createNetworkRule('||example.org^$script', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(false);

        // $script and $stylesheet
        rule = createNetworkRule('||example.org^$script,stylesheet', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Stylesheet);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(false);

        // Everything except $script and $stylesheet
        rule = createNetworkRule('||example.org^$~script,~stylesheet', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Stylesheet);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when content type ping is applied properly', () => {
        const rule = createNetworkRule('||example.org^$ping', 0);
        const request = new Request('https://example.org/', null, RequestType.Ping);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $ctag modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = createNetworkRule('||example.org^$ctag=device_pc', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientTags = ['device_pc'];
        expect(rule.match(request)).toBeTruthy();

        request.clientTags = ['device_pc', 'device_phone'];
        expect(rule.match(request)).toBeFalsy();

        request.clientTags = ['device_phone'];
        expect(rule.match(request)).toBeFalsy();

        rule = createNetworkRule('||example.org^$ctag=device_phone|device_pc', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientTags = ['device_pc'];
        expect(rule.match(request)).toBeTruthy();

        request.clientTags = ['device_pc', 'device_phone'];
        expect(rule.match(request)).toBeTruthy();

        request.clientTags = ['device_phone'];
        expect(rule.match(request)).toBeTruthy();

        rule = createNetworkRule('||example.org^$ctag=~device_phone|device_pc', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientTags = ['device_pc'];
        expect(rule.match(request)).toBeTruthy();

        request.clientTags = ['device_pc', 'device_phone'];
        expect(rule.match(request)).toBeFalsy();

        request.clientTags = ['device_phone'];
        expect(rule.match(request)).toBeFalsy();
    });

    it('works when $dnstype modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = createNetworkRule('||example.org^$dnstype=TXT|AAAA', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.dnsType = 'AAAA';
        expect(rule.match(request)).toBeTruthy();

        request.dnsType = 'CNAME';
        expect(rule.match(request)).toBeFalsy();

        rule = createNetworkRule('||example.org^$dnstype=~TXT|~AAAA', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.dnsType = 'AAAA';
        expect(rule.match(request)).toBeFalsy();

        request.dnsType = 'CNAME';
        expect(rule.match(request)).toBeTruthy();
    });

    it('works when $all modifier is applied properly', () => {
        let request: Request;
        const rule = createNetworkRule('||example.org^$all', 0);

        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.SubDocument);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Stylesheet);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Object);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.XmlHttpRequest);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Media);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Font);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.WebSocket);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Ping);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $client modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = createNetworkRule('||example.org^$client=name', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '127.0.0.1';
        request.clientName = 'name';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '127.0.0.1';
        request.clientName = 'another-name';
        expect(rule.match(request)).toBeFalsy();

        rule = createNetworkRule("||example.org^$client=~'Frank\\'s laptop'", 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientName = "Frank's phone";
        expect(rule.match(request)).toBeTruthy();

        request.clientName = "Frank's laptop";
        expect(rule.match(request)).toBeFalsy();

        rule = createNetworkRule('||example.org^$client=127.0.0.1', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '127.0.0.1';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '127.0.0.2';
        expect(rule.match(request)).toBeFalsy();

        rule = createNetworkRule('||example.org^$client=127.0.0.0/8', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '127.1.1.1';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '126.0.0.0';
        expect(rule.match(request)).toBeFalsy();

        rule = createNetworkRule('||example.org^$client=2001::c0:ffee', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '2001::c0:ffee';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '2001::c0:ffef';
        expect(rule.match(request)).toBeFalsy();

        rule = createNetworkRule('||example.org^$client=2001::0:00c0:ffee/112', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '2001::0:c0:0';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '2001::c1:ffee';
        expect(rule.match(request)).toBeFalsy();
    });

    it('applies $method modifier properly', () => {
        // Correctly matches method that is specified in permitted methods list
        let rule = createNetworkRule('||example.org^$method=get|delete', 0);
        let request = new Request('https://example.org/', 'https://example.org/', RequestType.Script, HTTPMethod.GET);
        expect(rule.match(request)).toBeTruthy();

        request.method = HTTPMethod.DELETE;
        expect(rule.match(request)).toBeTruthy();

        request.method = HTTPMethod.POST;
        expect(rule.match(request)).toBeFalsy();

        // Correctly matches method that is not present in restricted methods list
        rule = createNetworkRule('@@||example.org^$method=~get|~head', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Script, HTTPMethod.POST);
        expect(rule.match(request)).toBeTruthy();

        request.method = HTTPMethod.PUT;
        expect(rule.match(request)).toBeTruthy();

        request.method = HTTPMethod.GET;
        expect(rule.match(request)).toBeFalsy();

        request.method = HTTPMethod.HEAD;
        expect(rule.match(request)).toBeFalsy();
    });

    it('applies $to modifier properly', () => {
        let rule: NetworkRule;
        let request: Request;
        rule = createNetworkRule('/ads$to=~evil.*|good.*,script', 0);

        expect(rule.getRestrictedToDomains()).toHaveLength(1);
        expect(rule.getPermittedToDomains()).toHaveLength(1);

        // Correctly matches domain that is specified in permitted domains list
        rule = createNetworkRule('/ads^$to=evil.com', 0);
        request = new Request('https://evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeTruthy();
        request = new Request('https://good.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeFalsy();

        // Correctly matches subdomain that is specified in permitted domains list
        rule = createNetworkRule('/ads^$to=sub.evil.com', 0);
        request = new Request('https://sub.evil.com/ads', 'https://example.org/', RequestType.Image);
        expect(rule.match(request)).toBeTruthy();

        // Inverted value excludes subdomain from matching
        rule = createNetworkRule('/ads^$to=evil.com|~sub.one.evil.com', 0);

        request = new Request('https://evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://one.evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://sub.one.evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeFalsy();

        request = new Request('https://sub.two.evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeTruthy();
    });

    it('work with regexp patterns that contain special character classes', () => {
        let rule = createNetworkRule(String.raw`/api\.github\.com\/\w{5}\/AdguardTeam/`, 0);

        const request = new Request('https://api.github.com/users/AdguardTeam', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        rule = createNetworkRule(String.raw`/api.github.com\/\w{5}\/AdguardTeam/`, 0);
        expect(rule.match(request)).toEqual(true);
    });
});

describe('NetworkRule.isHigherPriority', () => {
    /**
     * Compares the priority of two network rules.
     *
     * @param left The left rule to compare.
     * @param right The right rule to compare.
     * @param expected The expected result of the comparison.
     */
    function compareRulesPriority(left: string, right: string, expected: boolean): void {
        const l = createNetworkRule(left, -1);
        const r = createNetworkRule(right, -1);

        expect(l.isHigherPriority(r)).toBe(expected);
    }

    type PriorityTestCase = {
        key: string;
        cases: [string, string, boolean][];
    };

    const priorityCases: PriorityTestCase[] = [
        {
            key: 'basicModifiers',
            cases: [
                ['||example.org', '||example.org$first-party', false],
                ['||example.org$first-party', '||example.org', true],
                ['||example.org$first-party', '||example.org$third-party', false],
                ['||example.org$first-party,match-case', '||example.org$first-party', true],
                ['||example.org$domain=~example.com', '||example.org$first-party', false],
                ['||example.org$domain=~example.com|~example.org', '||example.org$first-party', false],
                ['||example.org$~document', '||example.org$first-party', false],
                ['||example.org$~document,~script', '||example.org$first-party', false],
                ['||example.org$~document,~script', '||example.org$domain=~example.com', false],
                ['||example.org$~document,~script', '||example.org$domain=~example.com|~example.org', false],
                // 1 negated domain === 2 negated domains
                ['||example.org$domain=~example.org|~example.com', '||example.org$domain=~example.org', false],
                // $to > simple blocking rule
                ['/ads$to=example.org', '||example.org/ads', true],
                // $to < $domain
                ['/ads$domain=example.org', '/ads$to=example.org', true],
            ],
        },
        {
            key: 'allowedContentTypes',
            cases: [
                // 1 content-type -> 2 content-types
                ['||example.org$script', '||example.org$script,stylesheet', true],
                // 1 content-type -> negated content-type
                ['||example.org$script', '||example.org$~script', true],
                ['||example.org$document', '||example.org$~document', true],
                // content-types -> negated domains
                ['||example.org$script', '||example.org$domain=~example.org', true],
                ['||example.org$script,stylesheet', '||example.org$domain=~example.org', true],
                ['||example.org$script,stylesheet,media', '||example.org$domain=~example.org', true],
                ['||example.org$script,stylesheet,domain=~example.org', '||example.org$domain=~example.org', true],
                ['||example.org$document', '||example.org$all', true],
                ['||example.org$script,stylesheet,media', '||example.org$all', true],
                ['||example.org$script,stylesheet,domain=~example.org', '||example.org$all', true],
                // 1 method -> 2 methods
                ['||example.org$method=get', '||example.org$method=get|post', true],
                // 1 method -> negated method
                ['||example.org$method=get', '||example.org$method=~get', true],
                // methods are even
                ['||example.org$method=get', '||example.org$method=options', false],
                // methods = content types
                ['||example.org$method=get', '||example.org$script', false],
            ],
        },
        {
            key: 'allowedDomains',
            cases: [
                ['||example.org$domain=example.*', '||example.org$domain=example.com', false],
                ['||example.org$domain=example.*', '||example.org$domain=example.com|example.org', true],
                ['||example.org$domain=example.org', '||example.org$script,stylesheet', true],
                // 1 domain -> 1 content-type
                ['||example.org$domain=example.org', '||example.org$script', true],
                // 1 domain -> 2 domains
                ['||example.org$domain=example.org', '||example.org$domain=example.*|adguard.*', true],
                ['||example.org$domain=example.org', '||example.org$domain=example.com|example.org', true],
                // 2 domains -> 3 domains
                ['||example.org$domain=domain=example.*|adguard.*', '||example.org$domain=example.com|example.org|example.net', true],
                ['||example.org$domain=example.com|example.org', '||example.org$domain=example.com|example.org|example.net', true],
                ['||example.org$script,domain=a.com,denyallow=x.com|y.com', '||example.org$script,domain=a.com', true],
            ],
        },
        {
            key: 'redirectRules',
            cases: [
                ['||example.org^$document,redirect=nooptext', '||example.org^$document', true],
                ['||example.org^$redirect=nooptext', '||example.org$all', true],
            ],
        },
        {
            key: 'specificExclusions',
            cases: [
                ['@@||example.org$elemhide', '||example.org$document', true],
                ['@@||example.org$generichide', '||example.org$document', true],
                ['@@||example.org$specifichide', '||example.org$document', true],
                ['@@||example.org$content', '||example.org$document', true],
                ['@@||example.org$urlblock', '||example.org$document', true],
                ['@@||example.org$genericblock', '||example.org$document', true],
                ['@@||example.org$jsinject', '||example.org$document', true],
                ['@@||example.org$extension', '||example.org$document', true],
            ],
        },
        {
            key: 'allowlistRules',
            cases: [
                // `@@.*$document` - is an alias to `@@.*$elemhide,content,jsinject,urlblock,popup,document`
                ['@@||example.org$document', '@@||example.org$elemhide', true],
                ['@@||example.org$document', '@@||example.org$content', true],
                ['@@||example.org$document', '@@||example.org$urlblock', true],
                ['@@||example.org$document', '@@||example.org$jsinject', true],
                ['@@||example.org$document', '@@||example.org$extension', true],
                ['@@||example.org$document,subdocument', '@@||example.org$elemhide', true],
            ],
        },
        {
            key: 'importantRules',
            cases: [
                ['||example.org^$document,redirect=nooptext,important', '||example.org^$document,redirect=nooptext', true],
                ['||example.org$domain=example.com,important', '||example.org^$document,important', true],
                ['@@||example.org$domain=example.com,important', '@@||example.org$domain=example.com|example.net,important', true],
            ],
        },
    ];

    priorityCases.forEach((casesGroup, currentIndex) => {
        describe(`respects group of ${casesGroup.key}`, () => {
            const lowerPriorityGroups = priorityCases.slice(0, currentIndex);
            const lowerPriorityCases = lowerPriorityGroups
                .map(({ cases }) => cases)
                .flat(1);

            const cases: PriorityTestCase['cases'] = [];
            casesGroup.cases.forEach((item) => {
                // Check case itself
                cases.push(item);
                // Add a comparison with all past cases from lower priority groups
                lowerPriorityCases.forEach((lowerPriorityCase) => {
                    cases.push([item[0], lowerPriorityCase[1], true]);
                });
            });

            it.each(cases)(
                '%s is a higher priority than %s, expected: %s',
                (left: string, right: string, expectedResult: boolean) => {
                    compareRulesPriority(left, right, expectedResult);
                },
            );
        });
    });
});

describe('NetworkRule.isFilteringDisabled', () => {
    const cases = [
        { rule: '@@||example.org^$document', expected: true },
        { rule: '@@||example.org^$elemhide,urlblock,content,jsinject', expected: true },
        { rule: '@@||example.org^$elemhide,jsinject,content', expected: false },
        { rule: '||example.org^$document', expected: false },
    ];

    it.each(cases)('should return $expected for rule $rule', ({ rule, expected }) => {
        expect((createNetworkRule(rule, 0)).isFilteringDisabled()).toBe(expected);
    });
});

describe('NetworkRule.isUnsafe', () => {
    const cases = [
        { rule: '||example.org^$csp=test', expected: true },
        { rule: '||example.org^$replace=/a/b/', expected: true },
        { rule: '||example.org^$cookie=test', expected: true },
        { rule: '||example.org^$redirect=noop.js', expected: true },
        { rule: '||example.org^$redirect-rule=noop.js', expected: true },
        { rule: '||example.org^$removeparam=test', expected: true },
        { rule: '||example.org^$removeheader=test', expected: true },
        { rule: '||example.org^$permissions=test', expected: true },
        { rule: '||example.org^$client=127.0.0.1', expected: true },
        { rule: '||example.org^$dnsrewrite=REFUSED', expected: true },
        { rule: '||example.org^$dnstype=A', expected: true },
        { rule: '||example.org^$ctag=device_audio', expected: true },

        { rule: '||example.com^', expected: false },
    ];

    it.each(cases)('should return $expected for rule $rule', ({ rule, expected }) => {
        expect((createNetworkRule(rule, 0)).isUnsafe()).toBe(expected);
    });
});

describe('Misc', () => {
    it('checks isHostLevelNetworkRule', () => {
        let rule;

        rule = createNetworkRule('||example.org^$important', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = createNetworkRule('||example.org^$important,badfilter', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = createNetworkRule('||example.org^$badfilter', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = createNetworkRule('||example.org^', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = createNetworkRule('@@||example.org^', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = createNetworkRule('||example.org^$~third-party', 0);
        expect(rule.isHostLevelNetworkRule()).toBeFalsy();

        rule = createNetworkRule('||example.org^$third-party', 0);
        expect(rule.isHostLevelNetworkRule()).toBeFalsy();

        rule = createNetworkRule('||example.org^$domain=example.com', 0);
        expect(rule.isHostLevelNetworkRule()).toBeFalsy();
    });
});
