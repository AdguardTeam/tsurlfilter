import { describe, expect, it } from 'vitest';

import { ElementUtils } from '../../../../../src/lib/common/content-script/utils/element-utils';

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

        // Encoded-semicolon form as produced by the new emitter (AG-265).
        result = ElementUtils.parseInfo("'adguard7%3B42'", 'adguard');
        expect(result).not.toBeNull();
        expect(result?.filterId).toBe(7);
        expect(result?.ruleIndex).toBe(42);
    });

    it('does not throw on malformed percent-escape in content', () => {
        // `decodeURIComponent` throws `URIError` on a malformed escape. The
        // helper is also inlined into the MV3 injected apply function, where
        // such a throw would break cosmetic application on every pass.
        expect(() => ElementUtils.parseInfo("'adguard100%'", 'adguard')).not.toThrow();
        expect(ElementUtils.parseInfo("'adguard100%'", 'adguard')).toBeNull();

        expect(() => ElementUtils.parseExtendedStyleInfo("'adguard100%' !important", 'adguard')).not.toThrow();
        expect(ElementUtils.parseExtendedStyleInfo("'adguard100%' !important", 'adguard')).toBeNull();
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
