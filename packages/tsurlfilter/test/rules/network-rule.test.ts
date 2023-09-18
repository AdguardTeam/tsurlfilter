/* eslint-disable max-len */
import {
    NetworkRule,
    NetworkRuleOption,
    Request,
    RequestType,
    HTTPMethod,
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

    it('works when it handles $all modifier', () => {
        let parts = NetworkRule.parseRuleText('||example.org^$all');
        expect(parts.pattern).toEqual('||example.org^');
        expect(parts.options).toEqual('all');
        expect(parts.allowlist).toEqual(false);

        parts = NetworkRule.parseRuleText('@@||example.com^$all');
        expect(parts.pattern).toEqual('||example.com^');
        expect(parts.options).toEqual('all');
        expect(parts.allowlist).toEqual(true);
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

    it('works when it creates rule with $all', () => {
        const rule = new NetworkRule('||example.org^$all', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('||example.org^$all');
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

    it('throws error if blacklist-only modifiers used in allowlist rule - $all', () => {
        expect(() => {
            new NetworkRule('@@||example.org^$all', 0);
        }).toThrowError('Rule with $all modifier can not be allowlist rule');
    });

    it('construct $domain rules with regexp values', () => {
        let rule: NetworkRule;
        rule = new NetworkRule(String.raw`||example.org$domain=/example\.(org\|com)/|evil.com`, 0);
        expect(rule.getPermittedDomains()).toEqual([String.raw`/example\.(org|com)/`, 'evil.com']);
        expect(rule.getRestrictedDomains()).toEqual(null);

        rule = new NetworkRule(String.raw`||example.org$domain=~/good\.evil\.(com\|org)/|/evil\.com/`, 0);
        expect(rule.getPermittedDomains()).toEqual([String.raw`/evil\.com/`]);
        expect(rule.getRestrictedDomains()).toEqual([String.raw`/good\.evil\.(com|org)/`]);
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

    it('throws error if $header modifier value is invalid', () => {
        expect(() => {
            new NetworkRule('||baddomain.com^$header', 0);
        }).toThrow(new SyntaxError('$header modifier value cannot be empty'));

        expect(() => {
            new NetworkRule('||baddomain.com^$header=name:', 0);
        }).toThrow(new SyntaxError('Invalid $header modifier value: "name:"'));
    });

    it('validates $header rules modifier compatibility', () => {
        // Check compatibility with other modifiers
        expect(() => {
            new NetworkRule(String.raw`||baddomain.com^$header=h1,csp=frame-src 'none'`, 0);
        }).not.toThrow();

        expect(() => {
            new NetworkRule('||baddomain.com^$header=h1,removeheader=param', 0);
        }).not.toThrow();

        expect(() => {
            new NetworkRule('||baddomain.com^$header=h1,removeheader=request:param', 0);
        }).toThrow(new SyntaxError('Request headers removal of $removeheaders is not compatible with $header rules.'));

        expect(() => {
            new NetworkRule('||baddomain.com^$header=h1,hls=urlpattern', 0);
        }).toThrow('$header rules are not compatible with some other modifiers');
    });

    it('throws error if $method modifier value is invalid', () => {
        expect(() => {
            new NetworkRule('||baddomain.com^$method=get', 0);
        }).not.toThrow();

        expect(() => {
            new NetworkRule('||baddomain.com^$method=', 0);
        }).toThrow(new SyntaxError('$method modifier value cannot be empty'));

        expect(() => {
            new NetworkRule('||baddomain.com^$method=invalid', 0);
        }).toThrow(new SyntaxError('Invalid $method modifier value: INVALID'));

        expect(() => {
            new NetworkRule('||baddomain.com^$method=get|~post', 0);
        }).toThrow(new SyntaxError('Negated values cannot be mixed with non-negated values: get|~post'));
    });

    it('throws error if $to modifier value is invalid', () => {
        expect(() => {
            new NetworkRule('/ads$to=example.org|~example.com', 0);
        }).not.toThrow();

        expect(() => {
            new NetworkRule('||*/ads^$to=evil.com', 0);
        }).not.toThrow();

        expect(() => {
            new NetworkRule('||baddomain.com^$to=', 0);
        }).toThrow(new SyntaxError('$to modifier value cannot be empty'));

        expect(() => {
            new NetworkRule('||baddomain.com^$to=example.org|', 0);
        }).toThrow(new SyntaxError('Empty domain specified in "example.org|"'));
    });

    it('throws error if $permissions modifier value is invalid', () => {
        expect(() => {
            new NetworkRule(String.raw`||example.org$permissions=permissions=oversized-images=()\,clipboard-read=(self)`, 0);
        }).not.toThrow();

        expect(() => {
            new NetworkRule(String.raw`@@||example.org$permissions`, 0);
        }).not.toThrow();

        expect(() => {
            new NetworkRule(String.raw`||example.org$permissions`, 0);
        }).toThrow(new SyntaxError('Invalid $permissions rule: permissions directive must not be empty'));

        expect(() => {
            new NetworkRule(String.raw`@@||example.org$permissions=geolocation=*`, 0);
        }).toThrow(new SyntaxError('Allowlist $permissions rule should not have directive specified: "geolocation=*"'));

        // Must throw on unsupported modifiers
        expect(() => {
            new NetworkRule(String.raw`||example.org$match-case,permissions=geolocation=(self)`, 0);
        }).toThrow(new SyntaxError('$permissions rules are not compatible with some other modifiers'));

        expect(() => {
            new NetworkRule(String.raw`||example.org$important,permissions=geolocation=(self)`, 0);
        }).not.toThrow();
    });

    it('thorws error if $to modifier value is invalid', () => {
        expect(() => {
            new NetworkRule('||*/ads^$to=evil.com', 0);
        }).not.toThrow();

        expect(() => {
            new NetworkRule('|*/ads^$to=', 0);
        }).toThrow(new SyntaxError('$to modifier value cannot be empty'));

        expect(() => {
            new NetworkRule('|*/ads^$to=evil.com|', 0);
        }).toThrow(new SyntaxError('Empty domain specified in "evil.com|"'));
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

        expect(() => {
            new NetworkRule('@@||example.org^$removeparam=p,document', 0);
        }).toThrow(new SyntaxError('$removeparam rules are not compatible with some other modifiers'));

        expect(() => {
            new NetworkRule('||example.org^$removeparam=p,domain=test.com,popup', 0);
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

        expect(() => {
            new NetworkRule('@@||example.org^$removeheader=header-name,document', 0);
        }).toThrow(new SyntaxError('$removeheader rules are not compatible with some other modifiers'));

        expect(() => {
            new NetworkRule('||example.org^$removeheader=header-name,domain=test.com,popup', 0);
        }).toThrow(new SyntaxError('$removeheader rules are not compatible with some other modifiers'));

        expect(() => {
            new NetworkRule('||baddomain.com^$header=h1,removeheader=request:param', 0);
        }).toThrow(new SyntaxError('Request headers removal of $removeheaders is not compatible with $header rules.'));
    });

    it('checks jsonprune modifier compatibility', () => {
        let correct;

        correct = new NetworkRule('||example.org/*/*/$xmlhttprequest,jsonprune=\\$..[ac\\, ab]', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org/*/*/$jsonprune=\\$..[ac\\, ab],xmlhttprequest', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org/*/*/$xmlhttprequest,jsonprune=\\$.data.*.attributes', 0);
        expect(correct).toBeTruthy();

        // TODO: add more specific jsonprune tests during the implementation
        // https://github.com/AdguardTeam/tsurlfilter/issues/71
    });

    it('checks hls modifier compatibility', () => {
        let correct;

        correct = new NetworkRule('||example.org^$hls=preroll', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$hls=\\/videoplayback^?*&source=dclk_video_ads', 0);
        expect(correct).toBeTruthy();

        correct = new NetworkRule('||example.org^$hls=/#UPLYNK-SEGMENT:.*\\,ad/t', 0);
        expect(correct).toBeTruthy();

        // TODO: add more specific jsonprune tests during the implementation
        // https://github.com/AdguardTeam/tsurlfilter/issues/72
    });

    it('checks to modifier compatibility', () => {
        expect(() => {
            new NetworkRule('/ads$to=good.org,denyallow=good.com', 0);
        }).toThrow(new SyntaxError('modifier $to is not compatible with $denyallow modifier'));
    });

    it('checks denyallow modifier compatibility', () => {
        expect(() => {
            new NetworkRule('/ads$to=good.org,denyallow=good.com', 0);
        }).toThrow(new SyntaxError('modifier $to is not compatible with $denyallow modifier'));
    });

    it('works when it handles wide rules with $domain properly', () => {
        const rule = new NetworkRule('$domain=ya.ru', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('$domain=ya.ru');
    });

    it('checks $all modifier compatibility', () => {
        const correct = new NetworkRule('||example.org^$all', 0);
        expect(correct).toBeTruthy();
    });

    it('works when it handles $all modifier', () => {
        const rule = new NetworkRule('||example.com^$all', 0);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('||example.com^$all');
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

        checkModifier('extension', NetworkRuleOption.Extension, true);
        checkModifier('~extension', NetworkRuleOption.Extension, false);

        checkModifier('network', NetworkRuleOption.Network, true);

        checkModifier('all', NetworkRuleOption.Popup, true);
    });

    function checkRequestType(name: string, requestType: RequestType, permitted: boolean): void {
        const rule = new NetworkRule(`||example.org^$${name}`, 0);
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

        const rule = new NetworkRule('||example.org^$all', 0);
        const allRequestTypes = Object.values(RequestType)
            .reduce((prevValue: number, curValue: number) => {
                return prevValue | curValue;
            }, RequestType.Document);
        expect(rule.getPermittedRequestTypes()).toEqual(allRequestTypes);
        expect(rule.getRestrictedRequestTypes()).toEqual(RequestType.NotSet);
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
        }).toThrow('Invalid modifier: $denyallow does not support wildcards and regex domains');

        // or have a regex value ($denyallow=/(x\|y)/)
        expect(() => {
            new NetworkRule('/some$denyallow=/domainname/,domain=example.com', -1);
        }).toThrow('Invalid modifier: $denyallow does not support wildcards and regex domains');
    });

    it('works if document modifier works properly', () => {
        let rule = new NetworkRule('||example.org^$document', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('@@||example.org^$document', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$document,script', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document | RequestType.Script);

        rule = new NetworkRule('||example.org^$document,popup', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$document,replace=/test/test2/', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$document,removeparam=p', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$~document', -1);
        expect(rule).toBeTruthy();
        expect(rule.getRestrictedRequestTypes()).toEqual(RequestType.Document);
    });

    it('works if all modifier works properly', () => {
        const rule = new NetworkRule('||example.org^$all', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Popup));
        const allRequestTypes = Object.values(RequestType)
            .reduce((prevValue: number, curValue: number) => {
                return prevValue | curValue;
            }, RequestType.Document);
        expect(rule.getPermittedRequestTypes()).toEqual(allRequestTypes);
    });

    it('works if doc modifier alias works properly', () => {
        let rule = new NetworkRule('||example.org^$doc', -1);
        expect(rule).toBeTruthy();
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$~doc', -1);
        expect(rule).toBeTruthy();
        expect(rule.getRestrictedRequestTypes()).toEqual(RequestType.Document);
    });

    it('works if popup modifier works properly with other request type modifiers', () => {
        let rule = new NetworkRule('||example.org^$popup', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Popup));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Document);

        rule = new NetworkRule('||example.org^$script,image,popup', -1);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Popup));
        expect(rule.getPermittedRequestTypes()).toEqual(RequestType.Script | RequestType.Image | RequestType.Document);
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
        // Rule's url has upper case characters
        let rule = new NetworkRule('||example.org/PATH$match-case', 0);
        let request = new Request('https://example.org/path', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        rule = new NetworkRule('||example.org/PATH$match-case', 0);
        request = new Request('https://example.org/PATH', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        // Rule's url have upper case characters
        rule = new NetworkRule('||example.org/path$match-case', 0);
        request = new Request('https://example.org/PATH', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        rule = new NetworkRule('||example.org/path$match-case', 0);
        request = new Request('https://example.org/path', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        // Rule's short url has upper case characters
        rule = new NetworkRule('/FILE.js$match-case', 0);
        request = new Request('https://example.org/file.js', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        rule = new NetworkRule('/FILE.js$match-case', 0);
        request = new Request('https://example.org/FILE.js', null, RequestType.Other);
        expect(rule.match(request)).toEqual(true);

        // Rule's short url doesn't have upper case characters
        rule = new NetworkRule('/file.js$match-case', 0);
        request = new Request('https://example.org/FILE.js', null, RequestType.Other);
        expect(rule.match(request)).toEqual(false);

        rule = new NetworkRule('/file.js$match-case', 0);
        request = new Request('https://example.org/file.js', null, RequestType.Other);
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
        request = new Request('https://example.org/', null, RequestType.SubDocument);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        rule = new NetworkRule('||example.org^$removeparam=p,script', 0);
        request = new Request('https://example.org/', null, RequestType.Document);
        expect(rule.match(request)).toEqual(false);
        request = new Request('https://example.org/', null, RequestType.SubDocument);
        expect(rule.match(request)).toEqual(false);

        request = new Request('https://example.org/', null, RequestType.Script);
        expect(rule.match(request)).toEqual(true);

        request = new Request('https://example.org/', null, RequestType.Image);
        expect(rule.match(request)).toEqual(false);

        rule = new NetworkRule('||example.org^$removeparam=p,~script', 0);
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
        request = new Request('https://example.org/', 'https://example.com/', RequestType.SubDocument);
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

    it('works when $domain modifier is applied properly - regexp', () => {
        let request: Request;
        const requestType: RequestType = RequestType.Script;

        const rule = new NetworkRule(String.raw`||test.ru^$domain=/\.(io\|com)/|~/good\.(org\|com)/`, 0);
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
        const rule = new NetworkRule(String.raw`||test.ru^$domain=/\.(io\|com)/|evil.*|ads.net|~/jwt\.io/|~evil.gov`, 0);
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

    it('works when $all modifier is applied properly', () => {
        let request: Request;
        const rule = new NetworkRule('||example.org^$all', 0);

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

    it('applies $method modifier properly', () => {
        // Correctly matches method that is specified in permitted methods list
        let rule = new NetworkRule('||example.org^$method=get|delete', 0);
        let request = new Request('https://example.org/', 'https://example.org/', RequestType.Script, HTTPMethod.GET);
        expect(rule.match(request)).toBeTruthy();

        request.method = HTTPMethod.DELETE;
        expect(rule.match(request)).toBeTruthy();

        request.method = HTTPMethod.POST;
        expect(rule.match(request)).toBeFalsy();

        // Correctly matches method that is not present in restricted methods list
        rule = new NetworkRule('@@||example.org^$method=~get|~head', 0);
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
        rule = new NetworkRule('/ads$to=~evil.*|good.*,script', 0);

        expect(rule.getRestrictedToDomains()).toHaveLength(1);
        expect(rule.getPermittedToDomains()).toHaveLength(1);

        // Correctly matches domain that is specified in permitted domains list
        rule = new NetworkRule('/ads^$to=evil.com', 0);
        request = new Request('https://evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeTruthy();
        request = new Request('https://good.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeFalsy();

        // Correctly matches subdomain that is specified in permitted domains list
        rule = new NetworkRule('/ads^$to=sub.evil.com', 0);
        request = new Request('https://sub.evil.com/ads', 'https://example.org/', RequestType.Image);
        expect(rule.match(request)).toBeTruthy();

        // Inverted value excludes subdomain from matching
        rule = new NetworkRule('/ads^$to=evil.com|~sub.one.evil.com', 0);

        request = new Request('https://evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://one.evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeTruthy();

        request = new Request('https://sub.one.evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeFalsy();

        request = new Request('https://sub.two.evil.com/ads', 'https://example.org/', RequestType.Script);
        expect(rule.match(request)).toBeTruthy();
    });
});

describe('NetworkRule.isHigherPriority', () => {
    function compareRulesPriority(left: string, right: string, expected: boolean): void {
        const l = new NetworkRule(left, -1);
        const r = new NetworkRule(right, -1);

        expect(l.isHigherPriority(r)).toBe(expected);
    }

    type PriorityTestCase = {
        key: string,
        cases: [string, string, boolean][],
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
                // $popup explicity adds $document content-type
                ['||example.org$popup', '||example.org$document,subdocument', true],
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

            test.each(cases)(
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
        expect((new NetworkRule(rule, 0)).isFilteringDisabled()).toBe(expected);
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
