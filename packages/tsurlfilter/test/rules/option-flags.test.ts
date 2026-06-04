import { describe, expect, it } from 'vitest';

import { OptionFlags } from '../../src/rules/network-rule';

describe('OptionFlags', () => {
    describe('createOption', () => {
        it('returns { lo: 0, hi: 0 } for bit 0 (NotSet)', () => {
            const result = OptionFlags.createOption(0);
            expect(result).toEqual({ lo: 0, hi: 0 });
        });

        it('sets bit 0 of lo for bit index 1', () => {
            const result = OptionFlags.createOption(1);
            expect(result).toEqual({ lo: 1, hi: 0 });
        });

        it('sets bit 1 of lo for bit index 2', () => {
            const result = OptionFlags.createOption(2);
            expect(result).toEqual({ lo: 2, hi: 0 });
        });

        it('sets bit 30 of lo for bit index 31 (last lo bit)', () => {
            const result = OptionFlags.createOption(31);
            // eslint-disable-next-line no-bitwise
            expect(result).toEqual({ lo: 1 << 30, hi: 0 });
        });

        it('sets bit 0 of hi for bit index 32 (first hi bit)', () => {
            const result = OptionFlags.createOption(32);
            expect(result).toEqual({ lo: 0, hi: 1 });
        });

        it('sets bit 1 of hi for bit index 33', () => {
            const result = OptionFlags.createOption(33);
            expect(result).toEqual({ lo: 0, hi: 2 });
        });

        it('each bit index produces a unique option', () => {
            const seen = new Set<string>();
            // 0 is NotSet, 1–62 are usable flags
            for (let i = 0; i <= 62; i += 1) {
                const opt = OptionFlags.createOption(i);
                const key = `${opt.lo}:${opt.hi}`;
                expect(seen.has(key)).toBe(false);
                seen.add(key);
            }
        });
    });

    describe('has', () => {
        it('detects a flag in a mask', () => {
            const a = OptionFlags.createOption(3);
            const mask = OptionFlags.or(OptionFlags.createOption(3), OptionFlags.createOption(5));
            expect(OptionFlags.has(a, mask)).toBe(true);
        });

        it('returns false when flag is not in mask', () => {
            const a = OptionFlags.createOption(4);
            const mask = OptionFlags.or(OptionFlags.createOption(3), OptionFlags.createOption(5));
            expect(OptionFlags.has(a, mask)).toBe(false);
        });
    });

    describe('isEmpty', () => {
        it('returns true for NotSet (createOption(0))', () => {
            expect(OptionFlags.isEmpty(OptionFlags.createOption(0))).toBe(true);
        });

        it('returns false for a set option', () => {
            expect(OptionFlags.isEmpty(OptionFlags.createOption(1))).toBe(false);
        });
    });

    describe('equals', () => {
        it('returns true for identical options', () => {
            expect(OptionFlags.equals(
                OptionFlags.createOption(5),
                OptionFlags.createOption(5),
            )).toBe(true);
        });

        it('returns false for different options', () => {
            expect(OptionFlags.equals(
                OptionFlags.createOption(5),
                OptionFlags.createOption(6),
            )).toBe(false);
        });
    });
});
