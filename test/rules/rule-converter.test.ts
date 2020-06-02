/* eslint-disable max-len */
import { RuleConverter } from '../../src/rules/rule-converter';

describe('General', () => {
    it('checks general method', () => {
        const rulesText = `
            example.org#%#//scriptlet('abort-on-property-read', 'I10C')
            example.org##+js(setTimeout-defuser.js, [native code], 8000)`;

        const converted = RuleConverter.convertRules(rulesText);

        expect(converted).not.toBeNull();
    });

    it('works if ubo script tag rules are converted properly', () => {
        let result = RuleConverter.convertRule('example.com##^script:some-another-rule(test)');
        expect(result).toHaveLength(1);
        expect(result).toContain('example.com##^script:some-another-rule(test)');

        result = RuleConverter.convertRule('example.com##^script:has-text(12313)');
        expect(result).toHaveLength(1);
        expect(result).toContain('example.com$$script[tag-content="12313"][max-length="262144"]');
    });

    it('converts css adguard rule', () => {
        const rule = 'firmgoogle.com#$#.pub_300x250 {display:block!important;}';
        let exp = 'firmgoogle.com#$#.pub_300x250 {display:block!important;}';
        let res = RuleConverter.convertRule(rule);

        expect(res).toHaveLength(1);
        expect(res).toContain(exp);

        const whitelistCssRule = 'example.com#@$#h1 { display: none!important; }';
        exp = 'example.com#@$#h1 { display: none!important; }';
        res = RuleConverter.convertRule(whitelistCssRule);

        expect(res).toHaveLength(1);
        expect(res).toContain(exp);
    });

    it('convert ubo comments', () => {
        let result = RuleConverter.convertRule('#####');
        expect(result).toHaveLength(1);
        expect(result).toContain('! #####');

        result = RuleConverter.convertRule('# ubo syntax comment');
        expect(result).toHaveLength(1);
        expect(result).toContain('! # ubo syntax comment');

        result = RuleConverter.convertRule('##selector');
        expect(result).toHaveLength(1);
        expect(result).toContain('##selector');
    });

    it('check css injection conversion', () => {
        let result = RuleConverter.convertRule('example.com##h1:style(background-color: blue !important)');
        expect(result).toHaveLength(1);
        expect(result).toContain('example.com#$#h1 { background-color: blue !important }');

        result = RuleConverter.convertRule('example.com#@#h1:style(background-color: blue !important)');
        expect(result).toHaveLength(1);
        expect(result).toContain('example.com#@$#h1 { background-color: blue !important }');
    });

    it('checks :remove() rules conversion', () => {
        let result = RuleConverter.convertRule('ekoteka.pl###popUpModal:remove()');
        expect(result).toHaveLength(1);
        expect(result).toContain('ekoteka.pl#$?##popUpModal { remove: true; }');

        result = RuleConverter.convertRule('aftonbladet.se##.jwplayer:has(.svp-sponsor-label):remove()');
        expect(result).toHaveLength(1);
        expect(result).toContain('aftonbladet.se#$?#.jwplayer:has(.svp-sponsor-label) { remove: true; }');
    });
});

describe('Options', () => {
    const checkConversionResult = (rule: string, expected: string): void => {
        const actual = RuleConverter.convertRule(rule);
        expect(actual).toHaveLength(1);
        expect(actual).toContain(expected);
    };

    it('converts empty and mp4 modifiers into redirect rules', () => {
        checkConversionResult('/(pagead2)/$domain=vsetv.com,empty,important', '/(pagead2)/$domain=vsetv.com,redirect=nooptext,important');
        checkConversionResult('||fastmap33.com^$empty', '||fastmap33.com^$redirect=nooptext');
    });

    it('checks $mp4 modifier should always go with $media modifier together', () => {
        checkConversionResult('||video.example.org^$mp4', '||video.example.org^$redirect=noopmp4-1s,media');
        checkConversionResult('||video.example.org^$media,mp4', '||video.example.org^$media,redirect=noopmp4-1s');
        checkConversionResult('||video.example.org^$media,mp4,domain=example.org', '||video.example.org^$media,redirect=noopmp4-1s,domain=example.org');
        checkConversionResult('||video.example.org^$mp4,domain=example.org,media', '||video.example.org^$redirect=noopmp4-1s,domain=example.org,media');
    });

    it('converts inline-script modifier into csp rule', () => {
        checkConversionResult('||vcrypt.net^$inline-script', '||vcrypt.net^$csp=script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:');
        checkConversionResult('||vcrypt.net^$frame,inline-script', '||vcrypt.net^$subdocument,csp=script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:');
    });

    it('converts inline-font modifier into csp rule', () => {
        checkConversionResult('||vcrypt.net^$inline-font', '||vcrypt.net^$csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:');
        checkConversionResult('||vcrypt.net^$inline-font,domain=example.org', '||vcrypt.net^$csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:,domain=example.org');
    });

    it('converts ghide, ehide options', () => {
        checkConversionResult('@@||example.com^$ghide', '@@||example.com^$generichide');
        checkConversionResult('@@||example.com^$ehide', '@@||example.com^$elemhide');
        checkConversionResult('@@||example.com^$ehide,jsinject', '@@||example.com^$elemhide,jsinject');
    });

    it('converts rules with $all modifier into few rules', () => {
        let rule = '||example.org^$all';
        let actual = RuleConverter.convertRule(rule);
        let exp1 = '||example.org^$document,popup';
        let exp2 = '||example.org^';
        let exp3 = '||example.org^$csp=script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:';
        let exp4 = '||example.org^$csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:';

        expect(actual).toHaveLength(4);
        expect(actual).toContain(exp1);
        expect(actual).toContain(exp2);
        expect(actual).toContain(exp3);
        expect(actual).toContain(exp4);

        // test rule with more options
        rule = '||example.org^$all,important';
        actual = RuleConverter.convertRule(rule);
        exp1 = '||example.org^$document,popup,important';
        exp2 = '||example.org^$important';
        exp3 = '||example.org^$csp=script-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:,important';
        exp4 = '||example.org^$csp=font-src \'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:,important';

        expect(actual).toHaveLength(4);
        expect(actual).toContain(exp1);
        expect(actual).toContain(exp2);
        expect(actual).toContain(exp3);
        expect(actual).toContain(exp4);
    });
});

describe('Scriptlets', () => {
    it('works if AG rule is not converted', () => {
        const rule = "example.org#%#//scriptlet('abort-on-property-read', 'I10C')";
        const exp = "example.org#%#//scriptlet('abort-on-property-read', 'I10C')";
        const res = RuleConverter.convertRule(rule);

        expect(res.length).toBe(1);
        expect(res[0]).toBe(exp);
    });

    it('works if AG rule exception is not converted', () => {
        const rule = "example.org#@%#//scriptlet('abort-on-property-read', 'I10C')";
        const exp = "example.org#@%#//scriptlet('abort-on-property-read', 'I10C')";
        const res = RuleConverter.convertRule(rule);

        expect(res.length).toBe(1);
        expect(res[0]).toBe(exp);
    });

    it('works if ubo scriptlets are converted properly', () => {
        let rule = 'example.org##+js(setTimeout-defuser.js, [native code], 8000)';
        let exp = 'example.org#%#//scriptlet(\'ubo-setTimeout-defuser.js\', \'[native code]\', \'8000\')';
        let res = RuleConverter.convertRule(rule);

        expect(res.length).toBe(1);
        expect(res[0]).toBe(exp);

        rule = 'example.org#@#+js(setTimeout-defuser.js, [native code], 8000)';
        exp = 'example.org#@%#//scriptlet(\'ubo-setTimeout-defuser.js\', \'[native code]\', \'8000\')';
        res = RuleConverter.convertRule(rule);

        expect(res.length).toBe(1);
        expect(res[0]).toBe(exp);

        rule = 'example.org#@#script:inject(abort-on-property-read.js, some.prop)';
        exp = 'example.org#@%#//scriptlet(\'ubo-abort-on-property-read.js\', \'some.prop\')';
        res = RuleConverter.convertRule(rule);

        expect(res.length).toBe(1);
        expect(res[0]).toBe(exp);
    });

    it('works if abp scriptlets are converted properly', () => {
        const rule = "example.org#$#hide-if-contains li.serp-item 'li.serp-item div.label'";
        const exp = 'example.org#%#//scriptlet(\'abp-hide-if-contains\', \'li.serp-item\', \'li.serp-item div.label\')';
        const res = RuleConverter.convertRule(rule);

        expect(res.length).toBe(1);
        expect(res[0]).toBe(exp);
    });

    it('works if multiple abp scriptlets are converted properly', () => {
        // eslint-disable-next-line max-len
        const rule = 'example.org#$#hide-if-has-and-matches-style \'d[id^="_"]\' \'div > s\' \'display: none\'; hide-if-contains /.*/ .p \'a[href^="/ad__c?"]\'';
        // eslint-disable-next-line max-len
        const exp1 = 'example.org#%#//scriptlet(\'abp-hide-if-has-and-matches-style\', \'d[id^="_"]\', \'div > s\', \'display: none\')';
        // eslint-disable-next-line max-len
        const exp2 = 'example.org#%#//scriptlet(\'abp-hide-if-contains\', \'/.*/\', \'.p\', \'a[href^="/ad__c?"]\')';
        const res = RuleConverter.convertRule(rule);

        expect(res.length).toBe(2);
        expect(res[0]).toBe(exp1);
        expect(res[1]).toBe(exp2);
    });
});

describe('Redirects', () => {
    it('works if AG rule is not converted', () => {
        const rule = '||example.com/banner$image,redirect=1x1-transparent.gif';
        const res = RuleConverter.convertRule(rule);

        expect(res).toHaveLength(1);
        expect(res[0]).toBe(rule);
    });

    it('works if redirect value is converted', () => {
        const rule = '||example.com/banner$image,redirect=1x1.gif';
        const exp = '||example.com/banner$image,redirect=1x1-transparent.gif';
        const res = RuleConverter.convertRule(rule);

        expect(res).toHaveLength(1);
        expect(res[0]).toBe(exp);
    });

    it('works if abp rewrite is converted', () => {
        const rule = '||example.com^$script,rewrite=abp-resource:blank-js';
        const exp = '||example.com^$script,redirect=noopjs';
        const res = RuleConverter.convertRule(rule);

        expect(res).toHaveLength(1);
        expect(res[0]).toBe(exp);
    });

    it('works if redirect is converted', () => {
        const rule = '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices_gpt.js';
        const exp = '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices-gpt';
        const res = RuleConverter.convertRule(rule);

        expect(res).toHaveLength(1);
        expect(res[0]).toBe(exp);
    });

    it('works if abp rewrite is converted in complicated case', () => {
        const rule = '||delivery.tf1.fr/pub$media,rewrite=abp-resource:blank-mp3,domain=tf1.fr';
        const exp = '||delivery.tf1.fr/pub$media,redirect=noopmp3-0.1s,domain=tf1.fr';
        const res = RuleConverter.convertRule(rule);

        expect(res).toHaveLength(1);
        expect(res[0]).toBe(exp);
    });
});
