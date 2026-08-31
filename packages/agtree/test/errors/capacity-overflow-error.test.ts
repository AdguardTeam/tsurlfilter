import { describe, expect, test } from 'vitest';

import { CapacityOverflowError } from '../../src/errors/capacity-overflow-error';

describe('CapacityOverflowError', () => {
    test('carries region, requested, hardCap and a descriptive message', () => {
        const err = new CapacityOverflowError('domains', 80_000, 65_536);
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('CapacityOverflowError');
        expect(err.region).toBe('domains');
        expect(err.requested).toBe(80_000);
        expect(err.hardCap).toBe(65_536);
        expect(err.message).toContain('domains');
        expect(err.message).toContain('80000');
        expect(err.message).toContain('65536');
    });

    test('is throwable and catchable as itself', () => {
        try {
            throw new CapacityOverflowError('tokens', 1_000_000, 262_144);
        } catch (e) {
            expect(e).toBeInstanceOf(CapacityOverflowError);
            expect((e as CapacityOverflowError).region).toBe('tokens');
        }
    });
});
