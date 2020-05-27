import { RuleConverter } from '../../src/rules/rule-converter';

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
