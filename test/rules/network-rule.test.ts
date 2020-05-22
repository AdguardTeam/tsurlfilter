/* eslint-disable max-len */
import {
    Request, RequestType, NetworkRuleOption, NetworkRule,
} from '../../src';

describe('NetworkRule.parseRuleText', () => {
    it('works when it parses the basic rules properly', () => {
        let parts = NetworkRule.parseRuleText('||example.org^');
        expect(parts.pattern).toEqual('||example.org^');
        expect(parts.options).toBeUndefined();
        expect(parts.whitelist).toEqual(false);

        parts = NetworkRule.parseRuleText('||example.org^$third-party');
        expect(parts.pattern).toEqual('||example.org^');
        expect(parts.options).toEqual('third-party');
        expect(parts.whitelist).toEqual(false);

        parts = NetworkRule.parseRuleText('@@||example.org^$third-party');
        expect(parts.pattern).toEqual('||example.org^');
        expect(parts.options).toEqual('third-party');
        expect(parts.whitelist).toEqual(true);

        parts = NetworkRule.parseRuleText('@@||example.org/this$is$path$third-party');
        expect(parts.pattern).toEqual('||example.org/this$is$path');
        expect(parts.options).toEqual('third-party');
        expect(parts.whitelist).toEqual(true);

        parts = NetworkRule.parseRuleText('||example.org/this$is$path$third-party');
        expect(parts.pattern).toEqual('||example.org/this$is$path');
        expect(parts.options).toEqual('third-party');
        expect(parts.whitelist).toEqual(false);
    });

    it('works when it handles regex rules properly', () => {
        let parts = NetworkRule.parseRuleText('/regex/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toBeUndefined();
        expect(parts.whitelist).toEqual(false);

        parts = NetworkRule.parseRuleText('@@/regex/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toBeUndefined();
        expect(parts.whitelist).toEqual(true);

        parts = NetworkRule.parseRuleText('@@/regex/$third-party');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toEqual('third-party');
        expect(parts.whitelist).toEqual(true);
    });

    it('works when it handles $replace properly', () => {
        let parts = NetworkRule.parseRuleText('@@/regex/$replace=/test/test2/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toEqual('replace=/test/test2/');
        expect(parts.whitelist).toEqual(true);

        parts = NetworkRule.parseRuleText('/regex/$replace=/test/test2/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toEqual('replace=/test/test2/');
        expect(parts.whitelist).toEqual(false);
    });

    it('works when it handles escaped delimiter properly', () => {
        let parts = NetworkRule.parseRuleText('||example.org\\$smth');
        expect(parts.pattern).toEqual('||example.org\\$smth');
        expect(parts.options).toBeUndefined();
        expect(parts.whitelist).toEqual(false);

        parts = NetworkRule.parseRuleText('/regex/$replace=/test\\$/test2/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toEqual('replace=/test\\$/test2/');
        expect(parts.whitelist).toEqual(false);
    });

    it('works when it handles incorrect rules properly', () => {
        expect(() => {
            NetworkRule.parseRuleText('@@');
        }).toThrowError(/The rule is too short:.+/);
    });
});

describe('NetworkRule constructor', () => {
    it('works when it creates simple rules properly', () => {
        const rule = new NetworkRule('||example.org^', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('||example.org^');
        expect(rule.isWhitelist()).toEqual(false);
        expect(rule.getShortcut()).toEqual('example.org');
        expect(rule.isRegexRule()).toEqual(false);
        expect(rule.getPermittedDomains()).toEqual(null);
        expect(rule.getRestrictedDomains()).toEqual(null);
        expect(rule.isGeneric()).toEqual(true);
    });

    it('works when it handles unknown modifiers properly', () => {
        expect(() => {
            new NetworkRule('||example.org^$unknown', 0);
        }).toThrowError(/Unknown modifier:.+/);
    });

    it('works when it handles whitelist-only modifiers properly', () => {
        expect(() => {
            new NetworkRule('||example.org^$elemhide', 0);
        }).toThrowError(/.* cannot be used in a blacklist rule/);
    });

    it('works when it handles blacklist-only modifiers properly', () => {
        expect(() => {
            new NetworkRule('@@||example.org^$popup', 0);
        }).toThrowError(/.* cannot be used in a whitelist rule/);
    });

    it('works when it handles empty $domain modifier', () => {
        expect(() => {
            new NetworkRule('||example.org^$domain=', 0);
        }).toThrowError(/domains cannot be empty/);
    });

    it('works when it handles empty domain inside a $domain modifier', () => {
        expect(() => {
            new NetworkRule('||example.org^$domain=example.com|', 0);
        }).toThrowError(/empty domain specified.*/);
    });

    it('works when it handles too wide rules properly', () => {
        expect(() => {
            new NetworkRule('*$third-party', 0);
        }).toThrowError(/The rule is too wide,.*/);
    });

    it('works when it handles too wide rules properly', () => {
        expect(() => {
            new NetworkRule('$third-party', 0);
        }).toThrowError(/The rule is too wide,.*/);
    });

    it('works when it handles too wide rules properly', () => {
        expect(() => {
            new NetworkRule('ad$third-party', 0);
        }).toThrowError(/The rule is too wide,.*/);
    });

    it('works when it handles wide rules with $domain properly', () => {
        const rule = new NetworkRule('$domain=ya.ru', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('$domain=ya.ru');
    });

    function checkModifier(name: string, option: NetworkRuleOption, enabled: boolean): void {
        let ruleText = `||example.org^$${name}`;
        if ((option & NetworkRuleOption.WhitelistOnly) === option) {
            ruleText = `@@${ruleText}`;
        }

        const rule = new NetworkRule(ruleText, 0);
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

        checkModifier('stealth', NetworkRuleOption.Stealth, true);
        checkModifier('badfilter', NetworkRuleOption.Badfilter, true);

        checkModifier('popup', NetworkRuleOption.Popup, true);
        checkModifier('empty', NetworkRuleOption.Empty, true);
        checkModifier('mp4', NetworkRuleOption.Mp4, true);
    });

    function checkRequestType(name: string, requestType: RequestType, permitted: boolean): void {
        const rule = new NetworkRule(`||example.org^$${name}`, 0);
        if (permitted) {
            expect(rule.getPermittedRequestTypes()).toEqual(requestType);
            expect(rule.getRestrictedRequestTypes()).toEqual(0);
        } else {
            expect(rule.getRestrictedRequestTypes()).toEqual(requestType);
            expect(rule.getPermittedRequestTypes()).toEqual(0);
        }
    }

    it('works when type modifiers are parsed properly', () => {
        checkRequestType('script', RequestType.Script, true);
        checkRequestType('~script', RequestType.Script, false);

        checkRequestType('stylesheet', RequestType.Stylesheet, true);
        checkRequestType('~stylesheet', RequestType.Stylesheet, false);

        checkRequestType('subdocument', RequestType.Subdocument, true);
        checkRequestType('~subdocument', RequestType.Subdocument, false);

        checkRequestType('object', RequestType.Object, true);
        checkRequestType('~object', RequestType.Object, false);

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

        checkRequestType('websocket', RequestType.Websocket, true);
        checkRequestType('~websocket', RequestType.Websocket, false);

        checkRequestType('other', RequestType.Other, true);
        checkRequestType('~other', RequestType.Other, false);
    });

    function assertBadfilterNegates(rule: string, badfilter: string, expected: boolean): void {
        const r = new NetworkRule(rule, -1);
        expect(r).toBeTruthy();

        const b = new NetworkRule(badfilter, -1);
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
});

describe('NetworkRule.match', () => {
    it('works when it matches simple rules properly', () => {
        const rule = new NetworkRule('||example.org^', 0);
        const request = new Request('https://example.org/', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when it matches regex rules properly', () => {
        const rule = new NetworkRule('/example\\.org/', 0);
        const request = new Request('https://example.org/', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $match-case is applied properly', () => {
        let rule = new NetworkRule('||example.org/PATH$match-case', 0);
        let request = new Request('https://example.org/path', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        rule = new NetworkRule('||example.org/PATH$match-case', 0);
        request = new Request('https://example.org/PATH', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $third-party modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = new NetworkRule('||example.org^$third-party', 0);

        // First-party 1
        request = new Request('https://example.org/', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        // First-party 2
        request = new Request('https://sub.example.org/', 'https://example.org/', RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        // Third-party
        request = new Request('https://example.org/', 'https://example.com', RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        rule = new NetworkRule('||example.org^$first-party', 0);

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
        rule = new NetworkRule('||example.org^$domain=example.org', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', 'https://subdomain.example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        // One permitted, subdomain restricted
        rule = new NetworkRule('||example.org^$domain=example.org|~subdomain.example.org', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', 'https://subdomain.example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        // One restricted
        rule = new NetworkRule('||example.org^$domain=~example.org', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', 'https://subdomain.example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        // Wide rule
        rule = new NetworkRule('$domain=example.org', 0);
        request = new Request('https://example.com/', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        // Match request url host
        rule = new NetworkRule('$domain=example.org', 0);
        request = new Request('https://example.org/', 'https://example.com/', RequestType.Document);
        expect(rule.match(request)).toEqual(true);

        // Match request url host
        rule = new NetworkRule('$domain=example.org', 0);
        request = new Request('https://example.org/', 'https://example.com/', RequestType.Subdocument);
        expect(rule.match(request)).toEqual(true);

        // Document or Subdocument only
        rule = new NetworkRule('$domain=example.org', 0);
        request = new Request('https://example.org/', 'https://example.com/', RequestType.Image);
        expect(rule.match(request)).toEqual(false);
    });

    it('works when content type restrictions are applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        // $script
        rule = new NetworkRule('||example.org^$script', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(false);

        // $script and $stylesheet
        rule = new NetworkRule('||example.org^$script,stylesheet', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Stylesheet);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(false);

        // Everything except $script and $stylesheet
        rule = new NetworkRule('||example.org^$~script,~stylesheet', 0);
        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Stylesheet);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
    });
});

describe('NetworkRule.isHigherPriority', () => {
    function compareRulesPriority(left: string, right: string, expected: boolean): void {
        const l = new NetworkRule(left, -1);
        const r = new NetworkRule(right, -1);

        expect(l.isHigherPriority(r)).toBe(expected);
    }

    it('checks rule priority', () => {
        compareRulesPriority('@@||example.org$important', '@@||example.org$important', false);
        compareRulesPriority('@@||example.org$important', '||example.org$important', true);
        compareRulesPriority('@@||example.org$important', '@@||example.org', true);
        compareRulesPriority('@@||example.org$important', '||example.org', true);

        // $important -> whitelist
        compareRulesPriority('||example.org$important', '@@||example.org$important', false);
        compareRulesPriority('||example.org$important', '||example.org$important', false);
        compareRulesPriority('||example.org$important', '@@||example.org', true);
        compareRulesPriority('||example.org$important', '||example.org', true);

        // whitelist -> basic
        compareRulesPriority('@@||example.org', '@@||example.org$important', false);
        compareRulesPriority('@@||example.org', '||example.org$important', false);
        compareRulesPriority('@@||example.org', '@@||example.org', false);
        compareRulesPriority('@@||example.org', '||example.org', true);

        compareRulesPriority('||example.org', '@@||example.org$important', false);
        compareRulesPriority('||example.org', '||example.org$important', false);
        compareRulesPriority('||example.org', '@@||example.org', false);
        compareRulesPriority('||example.org', '||example.org', false);

        // specific -> generic
        compareRulesPriority('||example.org$domain=example.org', '||example.org$script,stylesheet', true);

        // more modifiers -> less modifiers
        compareRulesPriority('||example.org$script,stylesheet', '||example.org$script', true);

        // domain option count
        compareRulesPriority('||example.org$domain=~example.org', '||example.org$script,stylesheet', false);
        compareRulesPriority('||example.org$domain=~example.org',
            '||example.org$script,stylesheet,domain=~example.org', false);
    });
});
