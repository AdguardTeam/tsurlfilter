/* eslint-disable max-len */
import {
    NetworkRule,
    NetworkRuleOption,
    Request,
    RequestType,
} from '../../src';

describe('NetworkRule.parseRuleText', () => {
    it('works when it parses the basic rules properly', () => {
        let parts = NetworkRule.parseRuleText('||example.org^');
        expect(parts.pattern).toEqual('||example.org^');
        expect(parts.options).toBeUndefined();
        expect(parts.allowlist).toEqual(false);

        parts = NetworkRule.parseRuleText('||example.org^$third-party');
        expect(parts.pattern).toEqual('||example.org^');
        expect(parts.options).toEqual('third-party');
        expect(parts.allowlist).toEqual(false);

        parts = NetworkRule.parseRuleText('@@||example.org^$third-party');
        expect(parts.pattern).toEqual('||example.org^');
        expect(parts.options).toEqual('third-party');
        expect(parts.allowlist).toEqual(true);

        parts = NetworkRule.parseRuleText('@@||example.org/this$is$path$third-party');
        expect(parts.pattern).toEqual('||example.org/this$is$path');
        expect(parts.options).toEqual('third-party');
        expect(parts.allowlist).toEqual(true);

        parts = NetworkRule.parseRuleText('||example.org/this$is$path$third-party');
        expect(parts.pattern).toEqual('||example.org/this$is$path');
        expect(parts.options).toEqual('third-party');
        expect(parts.allowlist).toEqual(false);
    });

    it('works when it handles regex rules properly', () => {
        let parts = NetworkRule.parseRuleText('/regex/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toBeUndefined();
        expect(parts.allowlist).toEqual(false);

        parts = NetworkRule.parseRuleText('@@/regex/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toBeUndefined();
        expect(parts.allowlist).toEqual(true);

        parts = NetworkRule.parseRuleText('@@/regex/$third-party');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toEqual('third-party');
        expect(parts.allowlist).toEqual(true);
    });

    it('works when it handles $replace properly', () => {
        let parts = NetworkRule.parseRuleText('@@/regex/$replace=/test/test2/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toEqual('replace=/test/test2/');
        expect(parts.allowlist).toEqual(true);

        parts = NetworkRule.parseRuleText('/regex/$replace=/test/test2/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toEqual('replace=/test/test2/');
        expect(parts.allowlist).toEqual(false);
    });

    it('works when it handles delimiter in $removeparam rules properly', () => {
        let parts = NetworkRule.parseRuleText('||example.com$removeparam=/regex/');
        expect(parts.pattern).toEqual('||example.com');
        expect(parts.options).toEqual('removeparam=/regex/');

        parts = NetworkRule.parseRuleText('||example.com$removeparam=/regex\\$/');
        expect(parts.pattern).toEqual('||example.com');
        expect(parts.options).toEqual('removeparam=/regex\\$/');

        /*
         It looks like '$/',
         There is another slash character (/) to the left of it,
         There is another unescaped $ character to the left of that slash character.
        */
        parts = NetworkRule.parseRuleText('||example.com$removeparam=/regex$/');
        expect(parts.pattern).toEqual('||example.com');
        expect(parts.options).toEqual('removeparam=/regex$/');
    });

    it('works when it handles escaped delimiter properly', () => {
        let parts = NetworkRule.parseRuleText('||example.org\\$smth');
        expect(parts.pattern).toEqual('||example.org\\$smth');
        expect(parts.options).toBeUndefined();
        expect(parts.allowlist).toEqual(false);

        parts = NetworkRule.parseRuleText('/regex/$replace=/test\\$/test2/');
        expect(parts.pattern).toEqual('/regex/');
        expect(parts.options).toEqual('replace=/test\\$/test2/');
        expect(parts.allowlist).toEqual(false);
    });

    it('works when it handles incorrect rules properly', () => {
        expect(() => {
            NetworkRule.parseRuleText('@@');
        }).toThrow(new SyntaxError('Rule is too short'));
    });
});

describe('NetworkRule constructor', () => {
    it('works when it creates simple rules properly', () => {
        const rule = new NetworkRule('||example.org^', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('||example.org^');
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
            new NetworkRule(`||example.org^$${unknownModifier}`, 0);
        }).toThrow(new SyntaxError(`Unknown modifier: ${unknownModifier}`));
    });

    it('throws error if allowlist-only modifier used in blacklist rule - $generichide', () => {
        expect(() => {
            new NetworkRule('||example.org^$generichide', 0);
        }).toThrow('cannot be used in blacklist rule');
    });

    it('throws error if allowlist-only modifier used in blacklist rule - $specifichide', () => {
        expect(() => {
            new NetworkRule('||example.org^$specifichide', 0);
        }).toThrow('cannot be used in blacklist rule');
    });

    it('throws error if allowlist-only modifier used in blacklist rule - $elemhide', () => {
        expect(() => {
            new NetworkRule('||example.org^$elemhide', 0);
        }).toThrowError('cannot be used in blacklist rule');
    });

    it('throws error if blacklist-only modifiers used in allowlist rule - $empty', () => {
        expect(() => {
            new NetworkRule('@@||example.org^$empty', 0);
        }).toThrowError('cannot be used in allowlist rule');
    });

    it('works when it handles empty $domain modifier', () => {
        expect(() => {
            new NetworkRule('||example.org^$domain=', 0);
        }).toThrow(new Error('Modifier $domain cannot be empty'));
    });

    it('works when it handles empty domain inside a $domain modifier', () => {
        expect(() => {
            new NetworkRule('||example.org^$domain=example.com|', 0);
        }).toThrow('Empty domain specified in');
    });

    it('throws error if host rule is provided', () => {
        expect(() => {
            const hostRule = '209.237.226.90  www.opensource.org';
            new NetworkRule(hostRule, 0);
        }).toThrow(new SyntaxError('Rule has spaces, seems to be an host rule'));
    });

    it('works when it handles too wide rules properly', () => {
        expect(() => {
            new NetworkRule('*$third-party', 0);
        }).toThrow(new SyntaxError('The rule is too wide, add domain restriction or make the pattern more specific'));

        expect(() => {
            new NetworkRule('||*$script', 0);
        }).toThrow(new SyntaxError('The rule is too wide, add domain restriction or make the pattern more specific'));

        expect(() => {
            new NetworkRule('$third-party', 0);
        }).toThrow(new SyntaxError('The rule is too wide, add domain restriction or make the pattern more specific'));

        expect(() => {
            new NetworkRule('ad$third-party', 0);
        }).toThrow(new SyntaxError('The rule is too wide, add domain restriction or make the pattern more specific'));
    });

    it('doesnt consider rules with app modifier too wide', () => {
        const rule = new NetworkRule('@@*$app=com.cinemark.mobile', 0);
        expect(rule).toBeTruthy();
    });

    it('handles restricted apps', () => {
        const rule = new NetworkRule('||baddomain.com^$app=org.good.app|~org.bad.app', 0);
        expect(rule.getRestrictedApps()).toContain('org.bad.app');
        expect(rule.getPermittedApps()).toContain('org.good.app');
    });

    it('throws error if app modifier is empty', () => {
        expect(() => {
            new NetworkRule('||baddomain.com^$app', 0);
        }).toThrow(new SyntaxError('$app modifier cannot be empty'));
    });

    it('checks removeparam modifier compatibility', () => {
        let correct = new NetworkRule('||example.org^$removeparam=p,domain=test.com,third-party,match-case', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$removeparam=p,domain=test.com,third-party,important,match-case', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$removeparam', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$removeparam=p,object', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$removeparam=p,~object', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$removeparam=p,media', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('@@||example.org^$removeparam=p,badfilter', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('@@||example.org^$removeparam=p,document', 0);
        expect(correct).toBeTruthy();

        expect(() => {
            new NetworkRule('||example.org^$removeparam=p,domain=test.com,popup', 0);
        }).toThrow(new SyntaxError('$removeparam rules are not compatible with some other modifiers'));

        expect(() => {
            new NetworkRule('||example.org^$removeparam=p,domain=test.com,mp4', 0);
        }).toThrow(new SyntaxError('$removeparam rules are not compatible with some other modifiers'));
    });

    it('checks removeheader modifier compatibility', () => {
        let correct = new NetworkRule('||example.org^$removeheader=header-name', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$removeheader=header-name,domain=test.com,third-party,important,match-case', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('@@||example.org^$removeheader', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$removeheader=header-name,object', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$removeheader=header-name,~object', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$removeheader=header-name,media', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('@@||example.org^$removeheader=header-name,badfilter', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('@@||example.org^$removeheader=header-name,document', 0);
        expect(correct).toBeTruthy();

        expect(() => {
            new NetworkRule('||example.org^$removeheader=header-name,domain=test.com,popup', 0);
        }).toThrow(new SyntaxError('$removeheader rules are not compatible with some other modifiers'));

        expect(() => {
            new NetworkRule('||example.org^$removeheader=header-name,domain=test.com,mp4', 0);
        }).toThrow(new SyntaxError('$removeheader rules are not compatible with some other modifiers'));
    });

    it('works when it handles wide rules with $domain properly', () => {
        const rule = new NetworkRule('$domain=ya.ru', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('$domain=ya.ru');
    });

    function checkModifier(name: string, option: NetworkRuleOption, enabled: boolean, allowlist = false): void {
        let ruleText = `||example.org^$${name}`;
        if (allowlist || (option & NetworkRuleOption.AllowlistOnly) === option) {
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

        checkModifier('document', NetworkRuleOption.Elemhide, true, true);
        checkModifier('document', NetworkRuleOption.Jsinject, true, true);
        checkModifier('document', NetworkRuleOption.Urlblock, true, true);
        checkModifier('document', NetworkRuleOption.Content, true, true);

        checkModifier('stealth', NetworkRuleOption.Stealth, true);
        checkModifier('badfilter', NetworkRuleOption.Badfilter, true);

        checkModifier('popup', NetworkRuleOption.Popup, true);
        checkModifier('popup', NetworkRuleOption.Popup, true, true);
        checkModifier('empty', NetworkRuleOption.Empty, true);
        checkModifier('mp4', NetworkRuleOption.Mp4, true);

        checkModifier('extension', NetworkRuleOption.Extension, true);
        checkModifier('~extension', NetworkRuleOption.Extension, false);

        checkModifier('network', NetworkRuleOption.Network, true);
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

        checkRequestType('ping', RequestType.Ping, true);
        checkRequestType('~ping', RequestType.Ping, false);

        checkRequestType('webrtc', RequestType.Webrtc, true);
        checkRequestType('~webrtc', RequestType.Webrtc, false);

        checkRequestType('document', RequestType.Document, true);
        checkRequestType('~document', RequestType.Document, false);
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

    it('works if noop modifier works properly', () => {
        let rule = new NetworkRule('||example.com$_', -1);
        expect(rule).toBeTruthy();

        rule = new NetworkRule('||example.com$_,replace=/bad/good/,____,image', -1);
        expect(rule).toBeTruthy();

        expect(() => {
            new NetworkRule('||example.com$_invalid_,replace=/bad/good/,____,image', -1);
        }).toThrow('Unknown modifier: _invalid_');
    });

    it('works if denyallow modifier works properly', () => {
        const rule = new NetworkRule('/some.png$denyallow=example.ru|example.uk', -1);
        expect(rule).toBeTruthy();

        // Domains in the modifier's parameter cannot be negated ($denyallow=~x.com)
        expect(() => {
            new NetworkRule('/some$denyallow=example.com|~example.org,domain=example.com', -1);
        }).toThrow('Invalid modifier: $denyallow domains cannot be negated');

        // or have a wildcard TLD ($denyallow=x.*)
        expect(() => {
            new NetworkRule('/some$denyallow=example.*,domain=example.com', -1);
        }).toThrow('Invalid modifier: $denyallow domains wildcards are not supported');
    });

    it('works if document modifier works properly', () => {
        let rule = new NetworkRule('||example.org^$document', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Document));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('@@||example.org^$document', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Document));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$document,script', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Document));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document | RequestType.Script);

        rule = new NetworkRule('||example.org^$document,popup', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Document));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$document,replace=/test/test2/', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Document));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$document,removeparam=p', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Document));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$~document', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionDisabled(NetworkRuleOption.Document));
        expect(rule.getRestrictedRequestTypes()).toEqual(RequestType.Document);
    });

    it('works if doc modifier alias works properly', () => {
        let rule = new NetworkRule('||example.org^$doc', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Document));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$~doc', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionDisabled(NetworkRuleOption.Document));
        expect(rule.getRestrictedRequestTypes()).toEqual(RequestType.Document);
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
    });

    describe('$domain modifier semantics', () => {
        it('matches target domain only if rule has excluded domains', () => {
            let request;
            let rule;

            // rule only with excluded domains
            rule = new NetworkRule('||example.*^$domain=~example.org|~example.com', 0);

            request = new Request('https://example.org', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();

            request = new Request('https://example.com', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();

            request = new Request('https://example.eu', null, RequestType.Document);
            expect(rule.match(request)).toBeTruthy();

            // rule with permitted and excluded domains
            rule = new NetworkRule('||example.*^$domain=example.org|~example.com', 0);

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

            const rule = new NetworkRule('||example.*^$domain=~example.com', 0);

            request = new Request('https://example.com', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();

            request = new Request('https://example.com', null, RequestType.Script);
            expect(rule.match(request)).toBeTruthy();

            request = new Request('https://example.org', 'https://example.com', RequestType.Script);
            expect(rule.match(request)).toBeFalsy();
        });

        it('matches target domain if pattern is not domain specific and not regex', () => {
            let request;
            const rule = new NetworkRule('com$domain=example.com', 0);

            request = new Request('https://example.com', null, RequestType.Document);
            expect(rule.match(request)).toBeTruthy();

            request = new Request('https://example.org/com', null, RequestType.Document);
            expect(rule.match(request)).toBeFalsy();
        });
    });

    it('works $removeparam modifier with content types logic', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = new NetworkRule('||example.org^$removeparam=p', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
        request = new Request('https://example.org/', null, RequestType.Subdocument);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        rule = new NetworkRule('||example.org^$removeparam=p,script', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(false);
        request = new Request('https://example.org/', null, RequestType.Subdocument);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        rule = new NetworkRule('||example.org^$removeparam=p,~script', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
        request = new Request('https://example.org/', null, RequestType.Subdocument);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $domain in uppercase', () => {
        const rule = new NetworkRule('$domain=ExaMple.com', 0);
        const request = new Request('https://example.com/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $denyallow modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = new NetworkRule('/some.png$denyallow=example.ru|example.uk', 0);
        request = new Request('https://example.ru/some.png', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.uk/some.png', 'https://example.org', RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.us/some.png', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.ua/some.png', 'https://example.org', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        // with $domain modifier
        rule = new NetworkRule('/some$domain=example.com|example.org,denyallow=example.ru|example.uk', 0);
        request = new Request('https://example.ru/some', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.uk/some', 'https://example.org', RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.us/some', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.ua/some', 'https://example.org', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        // exception rule
        rule = new NetworkRule('@@/some$domain=example.com,denyallow=example.org', 0);
        request = new Request('https://example.net/some', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/some', 'https://example.com', RequestType.Image);
        expect(rule.match(request)).toEqual(false);
    });

    it('works when $domain modifier is applied properly - hostname', () => {
        let rule: NetworkRule;
        let request: Request;

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

        // Not matching domain specific patterns
        rule = new NetworkRule('||example.org/path$domain=example.org', 0);
        request = new Request('https://example.org/path', 'https://example.com/', RequestType.Document);
        expect(rule.match(request)).toEqual(false);

        // Match any domain pattern
        rule = new NetworkRule('path$domain=example.org', 0);
        request = new Request('https://example.org/path', 'https://example.com/', RequestType.Document);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $domain modifier is applied properly - wildcards', () => {
        let request: Request;

        const rule = new NetworkRule('||test.ru/^$domain=~nigma.*|google.*,third-party,match-case,popup', 0);

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

    it('works when content type ping is applied properly', () => {
        const rule = new NetworkRule('||example.org^$ping', 0);
        const request = new Request('https://example.org/', null, RequestType.Ping);
        expect(rule.match(request)).toEqual(true);
    });

    it('works when $ctag modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = new NetworkRule('||example.org^$ctag=device_pc', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientTags = ['device_pc'];
        expect(rule.match(request)).toBeTruthy();

        request.clientTags = ['device_pc', 'device_phone'];
        expect(rule.match(request)).toBeFalsy();

        request.clientTags = ['device_phone'];
        expect(rule.match(request)).toBeFalsy();

        rule = new NetworkRule('||example.org^$ctag=device_phone|device_pc', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientTags = ['device_pc'];
        expect(rule.match(request)).toBeTruthy();

        request.clientTags = ['device_pc', 'device_phone'];
        expect(rule.match(request)).toBeTruthy();

        request.clientTags = ['device_phone'];
        expect(rule.match(request)).toBeTruthy();

        rule = new NetworkRule('||example.org^$ctag=~device_phone|device_pc', 0);
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

        rule = new NetworkRule('||example.org^$dnstype=TXT|AAAA', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.dnsType = 'AAAA';
        expect(rule.match(request)).toBeTruthy();

        request.dnsType = 'CNAME';
        expect(rule.match(request)).toBeFalsy();

        rule = new NetworkRule('||example.org^$dnstype=~TXT|~AAAA', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.dnsType = 'AAAA';
        expect(rule.match(request)).toBeFalsy();

        request.dnsType = 'CNAME';
        expect(rule.match(request)).toBeTruthy();
    });

    it('works when $client modifier is applied properly', () => {
        let rule: NetworkRule;
        let request: Request;

        rule = new NetworkRule('||example.org^$client=name', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '127.0.0.1';
        request.clientName = 'name';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '127.0.0.1';
        request.clientName = 'another-name';
        expect(rule.match(request)).toBeFalsy();

        rule = new NetworkRule("||example.org^$client=~'Frank\\'s laptop'", 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientName = "Frank's phone";
        expect(rule.match(request)).toBeTruthy();

        request.clientName = "Frank's laptop";
        expect(rule.match(request)).toBeFalsy();

        rule = new NetworkRule('||example.org^$client=127.0.0.1', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '127.0.0.1';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '127.0.0.2';
        expect(rule.match(request)).toBeFalsy();

        rule = new NetworkRule('||example.org^$client=127.0.0.0/8', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '127.1.1.1';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '126.0.0.0';
        expect(rule.match(request)).toBeFalsy();

        rule = new NetworkRule('||example.org^$client=2001::c0:ffee', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '2001::c0:ffee';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '2001::c0:ffef';
        expect(rule.match(request)).toBeFalsy();

        rule = new NetworkRule('||example.org^$client=2001::0:00c0:ffee/112', 0);
        request = new Request('https://example.org/', 'https://example.org/', RequestType.Document);
        expect(rule.match(request)).toBeFalsy();

        request.clientIP = '2001::0:c0:0';
        expect(rule.match(request)).toBeTruthy();

        request.clientIP = '2001::c1:ffee';
        expect(rule.match(request)).toBeFalsy();
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

        // $important -> allowlist
        compareRulesPriority('||example.org$important', '@@||example.org$important', false);
        compareRulesPriority('||example.org$important', '||example.org$important', false);
        compareRulesPriority('||example.org$important', '@@||example.org', true);
        compareRulesPriority('||example.org$important', '||example.org', true);

        // allowlist -> basic
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
        compareRulesPriority('||example.org$domain=~example.org', '||example.org$script,stylesheet,media', false);
        compareRulesPriority(
            '||example.org$domain=~example.org',
            '||example.org$script,stylesheet,domain=~example.org',
            false,
        );
    });
});

describe('Misc', () => {
    it('checks isHostLevelNetworkRule', () => {
        let rule;

        rule = new NetworkRule('||example.org^$important', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = new NetworkRule('||example.org^$important,badfilter', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = new NetworkRule('||example.org^$badfilter', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = new NetworkRule('||example.org^', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = new NetworkRule('@@||example.org^', 0);
        expect(rule.isHostLevelNetworkRule()).toBeTruthy();

        rule = new NetworkRule('||example.org^$~third-party', 0);
        expect(rule.isHostLevelNetworkRule()).toBeFalsy();

        rule = new NetworkRule('||example.org^$third-party', 0);
        expect(rule.isHostLevelNetworkRule()).toBeFalsy();

        rule = new NetworkRule('||example.org^$domain=example.com', 0);
        expect(rule.isHostLevelNetworkRule()).toBeFalsy();
    });
});
