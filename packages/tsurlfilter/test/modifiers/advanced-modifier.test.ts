/* eslint-disable max-len */
import { NetworkRule, NetworkRuleOption } from '../../src';
import { ReplaceModifier } from '../../src/modifiers/replace-modifier';
import { CspModifier } from '../../src/modifiers/csp-modifier';
import { CookieModifier } from '../../src/modifiers/cookie-modifier';
import { RedirectModifier } from '../../src/modifiers/redirect-modifier';
import { RemoveParamModifier } from '../../src/modifiers/remove-param-modifier';

describe('NetworkRule - csp rules', () => {
    it('works if csp modifier is correctly parsed', () => {
        const directive = 'frame-src \'none\'';
        const rule = new NetworkRule(`||example.org^$csp=${directive}`, 0);
        expect(rule).toBeTruthy();
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CspModifier);
        expect(rule.getAdvancedModifierValue()).toBe(directive);
    });

    it('works if csp modifier is correctly parsed', () => {
        const directive = 'frame-src \'none\'';
        const rule = new NetworkRule(`||example.org^$csp=${directive},subdocument`, 0);
        expect(rule).toBeTruthy();
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CspModifier);
        expect(rule.getAdvancedModifierValue()).toBe(directive);
    });

    it('works if invalid csp modifier is detected', () => {
        expect(() => {
            new NetworkRule('||example.org$csp=', 0);
        }).toThrowError(/CSP directive must not be empty*/);

        expect(() => {
            new NetworkRule('||example.org$csp=report-uri /csp-violation-report-endpoint/', 0);
        }).toThrowError(/Forbidden CSP directive:*/);

        expect(() => {
            new NetworkRule('||example.org$csp=report-to /csp-violation-report-endpoint/', 0);
        }).toThrowError(/Forbidden CSP directive:*/);
    });
});

describe('NetworkRule - replace rules', () => {
    it('works if replace modifier is correctly parsed', () => {
        const replaceOptionText = '/text-to-be-replaced/new-text/i';
        const rule = new NetworkRule(`||example.org^$replace=${replaceOptionText}`, 0);
        expect(rule).toBeTruthy();
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ReplaceModifier);
        expect(rule.getAdvancedModifierValue()).toBe(replaceOptionText);
    });

    it('works if replace modifier is correctly parsed in regexp rule', () => {
        const replaceOptionText = '/text-to-be-replaced/new-text/i';
        const rule = new NetworkRule(`/.*/$replace=${replaceOptionText},domain=example.org`, 0);
        expect(rule).toBeTruthy();
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ReplaceModifier);
        expect(rule.getAdvancedModifierValue()).toBe(replaceOptionText);
    });

    it('works if empty replace modifier is correctly parsed', () => {
        const replaceOptionText = '/banner //i';
        const rule = new NetworkRule(`||example.org^$replace=${replaceOptionText},~third-party,xmlhttprequest`, 0);
        expect(rule).toBeTruthy();
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ReplaceModifier);
        expect(rule.getAdvancedModifierValue()).toBe(replaceOptionText);
    });

    it('works for replace modifier with few replace groups', () => {
        const replaceOptionText = '/(remove ")[\\s\\S]*(" from string)/\\$1\\$2/';
        const rule = new NetworkRule(`||example.org^$replace=${replaceOptionText}`, 0);
        expect(rule).toBeTruthy();
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ReplaceModifier);
        expect(rule.getAdvancedModifierValue()).toBe(replaceOptionText);
    });

    it('works if it throws incorrect rule', () => {
        expect(() => {
            new NetworkRule('||example.org^$replace=/1/2/3/', 0);
        }).toThrowError(/Cannot parse*/);
    });
});

describe('NetworkRule - replace rules apply', () => {
    it('checks replace apply for cyrillic texts', () => {
        const input = '<title>Старый текст</title>';
        const expected = '<title>Новый текст</title>';

        const modifier = new ReplaceModifier('/старый ТЕКСТ/Новый текст/i');
        expect(modifier).toBeTruthy();

        const applyFunc = modifier.getApplyFunc();
        expect(applyFunc).toBeTruthy();
        expect(applyFunc(input)).toBe(expected);
    });

    it('checks replace apply for jsons', () => {
        const input = `
        {
            "enabled": true,
            "force_disabled": false
        }`;

        const expected = `
        {
            "enabled": false,
            "force_disabled": false
        }`;

        const modifier = new ReplaceModifier('/"enabled": true,/"enabled": false,/i');
        expect(modifier).toBeTruthy();

        const applyFunc = modifier.getApplyFunc();
        expect(applyFunc).toBeTruthy();
        expect(applyFunc(input)).toBe(expected);
    });

    it('checks replace apply for vast text', () => {
        const input = '<?xml version="1.0" encoding="utf-8"?>\n'
                + '<VAST version="2.0">\n'
                + '    <Ad id="VPAID">\n'
                + '        <InLine>\n'
                + '            <AdSystem version="3.1">LiveRail</AdSystem>\n'
                + '            <AdTitle>VPAID Ad Manager</AdTitle>\n'
                + '            <Impression></Impression>\n'
                + '            <Creatives>\n'
                + '                <Creative sequence="1">\n'
                + '                    <Linear>\n'
                + '                        <Duration>00:00:15</Duration>\n'
                + '                        <MediaFiles>\n'
                + '                            <MediaFile delivery="progressive" width="640" height="480" scalable="1" type="application/javascript" apiFramework="VPAID"><![CDATA[http://cdn-static.liverail.com/js/LiveRail.AdManager-1.0.js?LR_PUBLISHER_ID=1331&LR_AUTOPLAY=0&LR_CONTENT=1&LR_TITLE=Foo&LR_VIDEO_ID=1234&LR_VERTICALS=international_news&LR_FORMAT=application/javascript]]></MediaFile>\n'
                + '                        </MediaFiles>\n'
                + '                    </Linear>\n'
                + '                </Creative>\n'
                + '\n'
                + '                <Creative sequence="1">\n'
                + '                    <CompanionAds>\n'
                + '                        <Companion width="300" height="250">\n'
                + '                            <HTMLResource><![CDATA[<div id="lr_comp_300x250" style=" width: 300px; height: 250px; display: none;"></div>]]></HTMLResource>\n'
                + '                        </Companion>\n'
                + '                        <Companion width="300" height="60">\n'
                + '                            <HTMLResource><![CDATA[<div id="lr_comp_300x60" style=" width: 300px; height: 60px; display: none;"></div>]]></HTMLResource>\n'
                + '                        </Companion>\n'
                + '                        <Companion width="728" height="90">\n'
                + '                            <HTMLResource><![CDATA[<div id="lr_comp_728x90" style=" width: 728px; height: 90px; display: none;"></div>]]></HTMLResource>\n'
                + '                        </Companion>\n'
                + '                    </CompanionAds>\n'
                + '                </Creative>\n'
                + '            </Creatives>\n'
                + '        </InLine>\n'
                + '    </Ad>\n'
                + '</VAST>';

        const expected = '<?xml version="1.0" encoding="utf-8"?>\n'
                + '<VAST version="2.0"></VAST>';

        const modifier = new ReplaceModifier('/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/$1<\\/VAST>/');
        expect(modifier).toBeTruthy();

        const applyFunc = modifier.getApplyFunc();
        expect(applyFunc).toBeTruthy();
        expect(applyFunc(input)).toBe(expected);
    });
});

describe('NetworkRule - cookie rules', () => {
    it('works if cookie modifier is correctly parsed', () => {
        const cookieOptionText = 'c_user';
        const rule = new NetworkRule(`||facebook.com^$third-party,cookie=${cookieOptionText}`, 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CookieModifier);
        expect(rule.getAdvancedModifierValue()).toBe(cookieOptionText);

        const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
        expect(cookieModifier.isEmpty()).toBeFalsy();
        expect(cookieModifier.matches('c_user')).toBeTruthy();
        expect(cookieModifier.matches('not_c_user')).toBeFalsy();
    });

    it('works if cookie modifier is correctly parsed', () => {
        const cookieOptionText = 'c_user';
        const rule = new NetworkRule(`$cookie=${cookieOptionText}`, 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CookieModifier);
        expect(rule.getAdvancedModifierValue()).toBe(cookieOptionText);

        const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
        expect(cookieModifier.isEmpty()).toBeFalsy();
        expect(cookieModifier.matches('c_user')).toBeTruthy();
        expect(cookieModifier.matches('not_c_user')).toBeFalsy();
    });

    it('works if cookie modifier regexp is correctly parsed', () => {
        const cookieOptionText = '/__utm[a-z]/';
        const rule = new NetworkRule(`$cookie=${cookieOptionText}`, 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CookieModifier);
        expect(rule.getAdvancedModifierValue()).toBe(cookieOptionText);

        const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
        expect(cookieModifier.isEmpty()).toBeFalsy();
        expect(cookieModifier.matches('__utma')).toBeTruthy();
        expect(cookieModifier.matches('__utm0')).toBeFalsy();
    });

    it('works if empty cookie modifier is correctly parsed', () => {
        const rule = new NetworkRule('@@||example.org^$cookie', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CookieModifier);
        expect(rule.getAdvancedModifierValue()).toBe('');

        const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
        expect(cookieModifier.isEmpty()).toBeTruthy();
        expect(cookieModifier.matches('123')).toBeTruthy();
        expect(cookieModifier.matches('aaaa')).toBeTruthy();
    });

    it('works if cookie modifier options are correctly parsed', () => {
        const cookieOptionText = '__cfduid;maxAge=15;sameSite=lax';
        const rule = new NetworkRule(`$cookie=${cookieOptionText}`, 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CookieModifier);
        expect(rule.getAdvancedModifierValue()).toBe(cookieOptionText);

        const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
        expect(cookieModifier.isEmpty()).toBeFalsy();
        expect(cookieModifier.matches('__cfduid')).toBeTruthy();
        expect(cookieModifier.matches('aaaa')).toBeFalsy();
        expect(cookieModifier.getMaxAge()).toBe(15);
        expect(cookieModifier.getSameSite()).toBe('lax');
    });

    it('works if it throws incorrect rule', () => {
        expect(() => {
            new NetworkRule('||example.org^$cookie=__cfduid;maxAge=15;sameSite=lax;some=some', 0);
        }).toThrowError(/Unknown \$cookie option:*/);
    });
});

describe('NetworkRule - redirect rules', () => {
    it('works if redirect modifier is correctly parsed', () => {
        const redirectValue = 'noopjs';
        const rule = new NetworkRule(`||example.org/script.js$script,redirect=${redirectValue}`, 0);
        expect(rule).toBeTruthy();
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RedirectModifier);
        expect(rule.getAdvancedModifierValue()).toBe(redirectValue);
    });

    it('works if redirect modifier is correctly parsed - mp4', () => {
        const redirectValue = 'noopmp4-1s';
        const rule = new NetworkRule(`||example.org/test.mp4$media,redirect=${redirectValue}`, 0);
        expect(rule).toBeTruthy();
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RedirectModifier);
        expect(rule.getAdvancedModifierValue()).toBe(redirectValue);
    });

    it('works for click2load redirect', () => {
        const redirectValue = 'click2load.html';
        const rule = new NetworkRule(`||example.org/embed/$subdocument,redirect=${redirectValue}`, 0);
        expect(rule).toBeTruthy();
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RedirectModifier);
        expect(rule.getAdvancedModifierValue()).toBe(redirectValue);
    });

    it('works if it throws empty redirect rule', () => {
        expect(() => {
            new NetworkRule('example.org/ads.js$script,redirect', 0);
        }).toThrow(new SyntaxError('Invalid $redirect rule, redirect value must not be empty'));
    });

    it('works if it throws incorrect rule', () => {
        expect(() => {
            new NetworkRule('example.org/ads.js$script,redirect=space', 0);
        }).toThrow(new SyntaxError('$redirect modifier is invalid'));
    });
});

describe('NetworkRule - redirect-rule rules', () => {
    it('works if redirect-rule modifier is correctly parsed', () => {
        const redirectValue = 'noopjs';
        const rule = new NetworkRule(`||example.org/script.js$script,redirect-rule=${redirectValue}`, 0);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Redirect));
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RedirectModifier);
        expect(rule.getAdvancedModifierValue()).toBe(redirectValue);
    });

    it('works if redirect-rule modifier is correctly parsed - mp4', () => {
        const redirectValue = 'noopmp4-1s';
        const rule = new NetworkRule(`||example.org/test.mp4$media,redirect-rule=${redirectValue}`, 0);
        expect(rule).toBeTruthy();
        expect(rule.isOptionEnabled(NetworkRuleOption.Redirect));
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RedirectModifier);
        expect(rule.getAdvancedModifierValue()).toBe(redirectValue);
    });

    it('works if it throws empty redirect-rule rule', () => {
        expect(() => {
            new NetworkRule('example.org/ads.js$script,redirect-rule', 0);
        }).toThrow(new SyntaxError('Invalid $redirect rule, redirect value must not be empty'));
    });

    it('works if it throws incorrect rule', () => {
        expect(() => {
            new NetworkRule('example.org/ads.js$script,redirect-rule=space', 0);
        }).toThrow(new SyntaxError('$redirect modifier is invalid'));
    });
});

describe('NetworkRule - removeparam rules', () => {
    it('works if removeparam modifier is correctly parsed', () => {
        let rule = new NetworkRule('$removeparam=param', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RemoveParamModifier);
        expect(rule.getAdvancedModifierValue()).toBe('param');

        rule = new NetworkRule('$removeparam=/p1|p2/', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RemoveParamModifier);
        expect(rule.getAdvancedModifierValue()).toBe('/p1|p2/');

        rule = new NetworkRule('$removeparam=/p1|p2|p3|p4/i', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RemoveParamModifier);
        expect(rule.getAdvancedModifierValue()).toBe('/p1|p2|p3|p4/i');

        rule = new NetworkRule('||example.org^$removeparam', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RemoveParamModifier);
        expect(rule.getAdvancedModifierValue()).toBe('');

        rule = new NetworkRule('||amazon.*$removeparam=*entries*', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RemoveParamModifier);
        expect(rule.getAdvancedModifierValue()).toBe('*entries*');
    });

    it('works if query parameters are correctly filtered', () => {
        const rule = new NetworkRule('$removeparam=p1', 0);
        const modifier = rule.getAdvancedModifier() as RemoveParamModifier;

        const comPage = 'http://example.com/page';
        expect(modifier.removeParameters(`${comPage}`)).toBe(`${comPage}`);
        expect(modifier.removeParameters(`${comPage}?p0=0`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1&p2=2`)).toBe(`${comPage}?p0=0&p2=2`);
    });

    it('works if query parameters are correctly filtered with regexp', () => {
        const rule = new NetworkRule('$removeparam=/p1|p2|p3|p4_.*/i', 0);
        const modifier = rule.getAdvancedModifier() as RemoveParamModifier;

        const comPage = 'http://example.com/page';
        expect(modifier.removeParameters(`${comPage}`)).toBe(`${comPage}`);
        expect(modifier.removeParameters(`${comPage}?p0=0`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1&p2=2&p3=3`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1&P2=2&P3=3`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p4_=4`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p4=4`)).toBe(`${comPage}?p0=0&p4=4`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p4_1=4`)).toBe(`${comPage}?p0=0`);
    });

    it('works if query parameters are removed by naked rule', () => {
        const rule = new NetworkRule('||example.org^$removeparam', 0);
        const modifier = rule.getAdvancedModifier() as RemoveParamModifier;

        const comPage = 'http://example.com/page';
        expect(modifier.removeParameters(`${comPage}`)).toBe(`${comPage}`);
        expect(modifier.removeParameters(`${comPage}?p0=0`)).toBe(`${comPage}`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1`)).toBe(`${comPage}`);
    });

    it('works if inverted removeparam is applied correctly', () => {
        const rule = new NetworkRule('$removeparam=~p0', 0);
        const modifier = rule.getAdvancedModifier() as RemoveParamModifier;

        const comPage = 'http://example.com/page';
        expect(modifier.removeParameters(`${comPage}`)).toBe(`${comPage}`);
        expect(modifier.removeParameters(`${comPage}?p0=0`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1&p2=2&p3=3`)).toBe(`${comPage}?p0=0`);
    });

    it('works if inverted regex removeparam is applied correctly', () => {
        const rule = new NetworkRule('$removeparam=~/p0.*/', 0);
        const modifier = rule.getAdvancedModifier() as RemoveParamModifier;

        const comPage = 'http://example.com/page';
        expect(modifier.removeParameters(`${comPage}`)).toBe(`${comPage}`);
        expect(modifier.removeParameters(`${comPage}?p0=0`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p01=0&p1=1&p2=2&p3=3`)).toBe(`${comPage}?p01=0`);
    });

    it('does not remove unmatched parameters', () => {
        let rule = new NetworkRule('$removeparam=p1', 0);
        let modifier = rule.getAdvancedModifier() as RemoveParamModifier;

        const url = 'https://l-stat.livejournal.net/js/??.comments.js?v=1619510974';
        expect(modifier.removeParameters(url)).toBe(url);

        rule = new NetworkRule('$removeparam=/comments/', 0);
        modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        expect(modifier.removeParameters(url)).toBe('https://l-stat.livejournal.net/js/');
    });

    it('preserves empty query string', () => {
        const url = 'https://example.org/path/file.js';

        let rule = new NetworkRule('$removeparam=p1', 0);
        let modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        expect(modifier.removeParameters(`${url}?`)).toBe(`${url}?`);

        rule = new NetworkRule('example.org$removeparam', 0);
        modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        expect(modifier.removeParameters(`${url}?`)).toBe(url);
    });

    it('doesnt apply to "?&" urls', () => {
        const url = 'https://example.org/path==.json';

        let rule = new NetworkRule('$removeparam=asg', 0);
        let modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        expect(modifier.removeParameters(`${url}?&test=1`)).toBe(`${url}?&test=1`);

        modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        expect(modifier.removeParameters(`${url}?t1=1&&t2=2`)).toBe(`${url}?t1=1&&t2=2`);

        rule = new NetworkRule('example.org$removeparam', 0);
        modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        expect(modifier.removeParameters(`${url}?&test=1`)).toBe(url);

        modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        expect(modifier.removeParameters(`${url}?&test=1&`)).toBe(url);
    });

    it('checks invalid parameters in removeparam', () => {
        expect(() => {
            new NetworkRule('||amazon.*$removeparam=/*entries*/', 0);
        }).toThrowError(/Invalid regular expression:*/);
    });

    it('preserves url hash', () => {
        const url = 'https://example.org?p1=1&p2=2#h1=1';

        let rule = new NetworkRule('$removeparam=p1', 0);
        let modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        expect(modifier.removeParameters(url)).toBe('https://example.org?p2=2#h1=1');

        rule = new NetworkRule('$removeparam=p2', 0);
        modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        expect(modifier.removeParameters(url)).toBe('https://example.org?p1=1#h1=1');
    });

    it('respects case by default', () => {
        const rule = new NetworkRule('$removeparam=P1', 0);
        const modifier = rule.getAdvancedModifier() as RemoveParamModifier;

        const comPage = 'http://example.com/page';
        expect(modifier.removeParameters(`${comPage}`)).toBe(`${comPage}`);
        expect(modifier.removeParameters(`${comPage}?p0=0`)).toBe(`${comPage}?p0=0`);
        expect(modifier.removeParameters(`${comPage}?p0=0&p1=1`)).toBe(`${comPage}?p0=0&p1=1`);
    });
});
