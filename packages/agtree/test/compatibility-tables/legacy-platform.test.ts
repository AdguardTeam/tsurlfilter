import { describe, expect, it } from 'vitest';

import { Platform } from '../../src/compatibility-tables';
import { modifiersCompatibilityTable } from '../../src/compatibility-tables/modifiers';
import { GenericPlatform, SpecificPlatform } from '../../src/compatibility-tables/platform-compat';
import { scriptletsCompatibilityTable } from '../../src/compatibility-tables/scriptlets';

describe('Legacy platform bitmask compatibility (CompatibilityTableBase.exists)', () => {
    it('maps specific platform masks onto concrete platforms', () => {
        expect(
            scriptletsCompatibilityTable.exists('prevent-innerHTML', SpecificPlatform.AbpExtChrome),
        ).toBe(
            scriptletsCompatibilityTable.supports('prevent-innerHTML', Platform.AbpExtChrome),
        );
        expect(
            scriptletsCompatibilityTable.exists('prevent-innerHTML', SpecificPlatform.AdgExtChrome),
        ).toBe(true);
        expect(
            scriptletsCompatibilityTable.exists('prevent-innerHTML', SpecificPlatform.AbpExtChrome),
        ).toBe(false);
    });

    it('maps AdgSafariAny onto the Safari/iOS content-blocker platforms', () => {
        expect(
            modifiersCompatibilityTable.exists('image', GenericPlatform.AdgSafariAny),
        ).toBe(true);
        expect(
            modifiersCompatibilityTable.exists('image', GenericPlatform.AdgSafariAny),
        ).toBe(
            modifiersCompatibilityTable.supports('image', Platform.AdgCbSafari)
            || modifiersCompatibilityTable.supports('image', Platform.AdgCbIos),
        );
    });

    it('expands chromium-only masks to their concrete members', () => {
        expect(
            scriptletsCompatibilityTable.exists('prevent-innerHTML', GenericPlatform.AdgExtChromium),
        ).toBe(true);
        // Firefox is not part of the chromium mask, so a Firefox-only check must
        // not leak in through the wildcard approximation.
        expect(
            scriptletsCompatibilityTable.exists(
                'prevent-innerHTML',
                GenericPlatform.AdgExtChromium,
            ),
        ).toBe(
            scriptletsCompatibilityTable.supports('prevent-innerHTML', Platform.AdgExtChrome)
            || scriptletsCompatibilityTable.supports('prevent-innerHTML', Platform.AdgExtOpera)
            || scriptletsCompatibilityTable.supports('prevent-innerHTML', Platform.AdgExtEdge),
        );
    });

    it('rejects unmapped masks instead of answering with name existence', () => {
        // 1 << 30 is not a valid SpecificPlatform/GenericPlatform bitmask.
        expect(() => modifiersCompatibilityTable.exists('image', 1 << 30)).toThrow();
    });
});
