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

        result = ElementUtils.parseInfo('\'adguard1;1\'', 'adguard');
        expect(result).not.toBeNull();
        expect(result?.filterId).toBe(1);
        expect(result?.ruleIndex).toBe(1);

        result = ElementUtils.parseInfo('\'adguard0;1;\'', 'adguard');
        expect(result).not.toBeNull();
        expect(result?.filterId).toBe(0);
        expect(result?.ruleIndex).toBe(1);
    });

    it('checks parseExtendedStyleInfo', () => {
        let result = ElementUtils.parseExtendedStyleInfo('', 'marker');
        expect(result).toBeNull();

        result = ElementUtils.parseExtendedStyleInfo('marker', '');
        expect(result).toBeNull();

        result = ElementUtils.parseExtendedStyleInfo('marker:1', 'marker');
        expect(result).toBeNull();

        result = ElementUtils.parseExtendedStyleInfo('\'adguard1;1\'', 'adguard');
        expect(result).not.toBeNull();
        expect(result?.filterId).toBe(1);
        expect(result?.ruleIndex).toBe(1);

        result = ElementUtils.parseExtendedStyleInfo('\'adguard1;1\' !important', 'adguard');
        expect(result).not.toBeNull();
        expect(result?.filterId).toBe(1);
        expect(result?.ruleIndex).toBe(1);
    });
});
