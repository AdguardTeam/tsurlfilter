import { describe, it, expect } from 'vitest';

import { AdblockProduct, getHumanReadableProductName } from '../../src/utils/adblockers';

describe('Adblockers Utils', () => {
    describe('getHumanReadableProductName', () => {
        it('should return human-readable name for Adblock Plus', () => {
            expect(getHumanReadableProductName(AdblockProduct.Abp)).toBe('AdBlock / Adblock Plus');
        });

        it('should return human-readable name for uBlock Origin', () => {
            expect(getHumanReadableProductName(AdblockProduct.Ubo)).toBe('uBlock Origin');
        });

        it('should return human-readable name for AdGuard', () => {
            expect(getHumanReadableProductName(AdblockProduct.Adg)).toBe('AdGuard');
        });

        it('should throw error for unknown product', () => {
            expect(() => getHumanReadableProductName('UnknownProduct' as AdblockProduct))
                .toThrow('Unknown product: UnknownProduct');
        });
    });
});
