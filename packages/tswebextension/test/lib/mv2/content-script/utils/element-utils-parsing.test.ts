import { ElementUtils } from '@lib/mv2/content-script/utils/element-utils';

describe('Element utils - parsing', () => {
    it('checks parseInfo', () => {
        let result = ElementUtils.parseInfo('', 'marker');
        expect(result).toBeNull();

        result = ElementUtils.parseInfo('marker', '');
        expect(result).toBeNull();

        result = ElementUtils.parseInfo('marker:1', 'marker');
        expect(result).toBeNull();

        result = ElementUtils.parseInfo('\'adguard-;ruleText\'', 'adguard');
        expect(result).toBeNull();

        result = ElementUtils.parseInfo('\'adguard1;ruleText\'', 'adguard');
        expect(result).not.toBeNull();
        expect(result?.filterId).toBe(1);
        expect(result?.ruleText).toBe('ruleText');

        result = ElementUtils.parseInfo('\'adguard0;adguardRule;\'', 'adguard');
        expect(result).not.toBeNull();
        expect(result?.filterId).toBe(0);
        expect(result?.ruleText).toBe('adguardRule;');
    });

    it('checks parseExtendedStyleInfo', () => {
        let result = ElementUtils.parseExtendedStyleInfo('', 'marker');
        expect(result).toBeNull();

        result = ElementUtils.parseExtendedStyleInfo('marker', '');
        expect(result).toBeNull();

        result = ElementUtils.parseExtendedStyleInfo('marker:1', 'marker');
        expect(result).toBeNull();

        result = ElementUtils.parseExtendedStyleInfo('\'adguard1;ruleText\'', 'adguard');
        expect(result).not.toBeNull();
        expect(result?.filterId).toBe(1);
        expect(result?.ruleText).toBe('ruleText');

        result = ElementUtils.parseExtendedStyleInfo('\'adguard1;ruleText\' !important', 'adguard');
        expect(result).not.toBeNull();
        expect(result?.filterId).toBe(1);
        expect(result?.ruleText).toBe('ruleText');
    });
});
