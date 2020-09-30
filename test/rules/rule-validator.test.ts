import { RuleValidator } from '../../src/utils/rule-validator';
import { CompatibilityTypes, setConfiguration } from '../../src';

describe('RuleValidator', () => {
    it('considers comments as valid rules', () => {
        const rule = '# this is comment';
        expect(RuleValidator.validate(rule).valid).toBeTruthy();
    });

    it('detects invalid scriptlets rules', () => {
        const invalidScriptletName = 'ubo-abort-current-inline-scripts.js';
        const validScriptletName = 'ubo-abort-current-inline-script.js';
        const getRule = (name: string): string => `test.com#%#//scriptlet("${name}", "Math.random", "adbDetect")`;

        const invalidRule = getRule(invalidScriptletName);
        expect(RuleValidator.validate(invalidRule).valid).toBeFalsy();

        const validRule = getRule(validScriptletName);
        expect(RuleValidator.validate(validRule).valid).toBeTruthy();
    });

    it('validates regexp rules', () => {
        // eslint-disable-next-line no-useless-escape
        const invalidRuleText = '/ex[[ampl[[e\.com\///.*\/banner/$script';
        expect(RuleValidator.validate(invalidRuleText).valid).toBeFalsy();

        // eslint-disable-next-line no-useless-escape
        const validRuleText = '/^https:\/\/([a-z]+\.)?sythe\.org\/\[=%#@$&!^].*[\w\W]{20,}/$image';
        expect(RuleValidator.validate(validRuleText).valid).toBeTruthy();
    });

    it('validates by compatibility', () => {
        setConfiguration({ compatibility: CompatibilityTypes.extension });
        const invalidExtensionRule = '@@||test.com^$generichide,app=iexplore.exe';
        expect(RuleValidator.validate(invalidExtensionRule).valid).toBeFalsy();

        setConfiguration({ compatibility: CompatibilityTypes.corelibs });
        const validCompilerRule = '@@||test.com^$generichide,app=iexplore.exe';
        expect(RuleValidator.validate(validCompilerRule).valid).toBeTruthy();

        setConfiguration({ compatibility: CompatibilityTypes.corelibs | CompatibilityTypes.extension });
        const validCompilerRule2 = '@@||test.com^$generichide,app=iexplore.exe';
        expect(RuleValidator.validate(validCompilerRule2).valid).toBeFalsy();
    });

    it('validates regexp\'s', () => {
        const invalidRules = [
            // eslint-disable-next-line no-useless-escape
            '/ex[[ampl[[e\.com\///.*\/banner/$script',
            // eslint-disable-next-line no-useless-escape
            '/^htt[[[ps?:\/\/.*(bitly|bit)\.(com|ly)\//$domain=1337x.to',
            // eslint-disable-next-line no-useless-escape
            '/\.sharesix\.com/.*[a-zA-Z0-9]({4}/$script',
        ];

        for (let i = 0; i < invalidRules.length; i += 1) {
            const invalidRule = invalidRules[i];
            expect(RuleValidator.validate(invalidRule).valid).toBeFalsy();
        }
    });

    it('validates style presence in css modifying rules', () => {
        const ruleText = 'iwantgames.ru#$#.article{ margin-top:0px!important; }';
        expect(RuleValidator.validate(ruleText).valid).toBeTruthy();
    });

    it('doesnt confuse url rules with regexp rules', () => {
        const ruleText = '/show?*&refer=$popup';
        expect(RuleValidator.validate(ruleText).valid).toBeTruthy();
    });

    it('validates rules $webrtc modifier', () => {
        const ruleText = '$webrtc,domain=browserleaks.com';
        expect(RuleValidator.validate(ruleText).valid).toBeTruthy();
    });

    it('invalidates rules with $protobuf modifier', () => {
        const ruleText = '||googleapis.com/youtubei/v1/browse?$important,protobuf=62887855|49413586|51621377';
        expect(RuleValidator.validate(ruleText).valid).toBeFalsy();
    });

    it('correctly validates html rules', () => {
        const ruleText = 'animalog.biz$$script[tag-content="window["open"]("about:blank")"][max-length="4200"]';
        expect(RuleValidator.validate(ruleText).valid).toBeTruthy();
    });

    it('correctly validates pseudo-class with comma after it', () => {
        // eslint-disable-next-line max-len
        const ruleText = 'nczas.com##.vc_single_image-img:last-child, .checkvisc';
        const validationResult = RuleValidator.validate(ruleText);
        expect(validationResult.valid).toBeTruthy();
    });
});
