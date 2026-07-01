import { getBitCount } from '../utils/bit-utils';

/**
 * Maximum number of usable bits per word (bits 0–30; bit 31 is the sign bit).
 */
const BITS_PER_LEVEL = 31;

/**
 * A wide bitfield stored as two 32-bit integers (`lo` and `hi`).
 * Supports up to 62 independent flags (bits 0–30 in each word).
 */
export type NetworkRuleOption = { lo: number; hi: number };

/**
 * Stateless utility class with static helpers for operating on
 * {@link NetworkRuleOption} (`{ lo, hi }`) wide bitfields.
 * Does not hold any instance state — all methods are pure static functions.
 */
export class OptionFlags {
    /**
     * Creates a {@link NetworkRuleOption} with a single bit set.
     * Bit 0 is reserved for `NotSet` and returns `{ lo: 0, hi: 0 }`.
     * Bits 1–31 go into `lo`; bits 32–62 automatically go into `hi`.
     *
     * @param bit Logical bit index (0–62). 0 means "not set".
     *
     * @returns A new `{ lo, hi }` object with that bit set.
     */
    public static createOption(bit: number): NetworkRuleOption {
        if (bit === 0) {
            return { lo: 0, hi: 0 };
        }

        const effective = bit - 1;

        if (effective < BITS_PER_LEVEL) {
            return { lo: 1 << effective, hi: 0 };
        }
        return { lo: 0, hi: 1 << (effective - BITS_PER_LEVEL) };
    }

    /**
     * Checks if all bits of `option` are set in `mask`.
     *
     * @param option Option flag(s) to test.
     * @param mask Mask to test against.
     *
     * @returns True if all bits of `option` are present in `mask`.
     */
    public static has(option: NetworkRuleOption, mask: NetworkRuleOption): boolean {
        return (mask.lo & option.lo) === option.lo
            && (mask.hi & option.hi) === option.hi;
    }

    /**
     * Returns true if both words are exactly equal.
     *
     * @param a First option flags.
     * @param b Second option flags.
     *
     * @returns True if equal.
     */
    public static equals(a: NetworkRuleOption, b: NetworkRuleOption): boolean {
        return a.lo === b.lo && a.hi === b.hi;
    }

    /**
     * Returns true if no bits are set.
     *
     * @param a Option flags to check.
     *
     * @returns True if empty (no bits set).
     */
    public static isEmpty(a: NetworkRuleOption): boolean {
        return a.lo === 0 && a.hi === 0;
    }

    /**
     * Bitwise OR — returns a new object.
     *
     * @param a First operand.
     * @param b Second operand.
     *
     * @returns New option flags with all bits from both operands.
     */
    public static or(a: NetworkRuleOption, b: NetworkRuleOption): NetworkRuleOption {
        return { lo: a.lo | b.lo, hi: a.hi | b.hi };
    }

    /**
     * Bitwise AND — returns a new object.
     *
     * @param a First operand.
     * @param b Second operand.
     *
     * @returns New option flags with only the bits common to both operands.
     */
    public static and(a: NetworkRuleOption, b: NetworkRuleOption): NetworkRuleOption {
        return { lo: a.lo & b.lo, hi: a.hi & b.hi };
    }

    /**
     * Bitwise XOR — returns a new object.
     *
     * @param a First operand.
     * @param b Second operand.
     *
     * @returns New option flags with bits that differ between operands.
     */
    public static xor(a: NetworkRuleOption, b: NetworkRuleOption): NetworkRuleOption {
        return { lo: a.lo ^ b.lo, hi: a.hi ^ b.hi };
    }

    /**
     * Mutates `target` in place — sets all bits from `flag`.
     *
     * @param target Target option flags to mutate.
     * @param flag Flag(s) to enable.
     */
    public static enable(target: NetworkRuleOption, flag: NetworkRuleOption): void {
        /* eslint-disable no-param-reassign */
        target.lo |= flag.lo;
        target.hi |= flag.hi;
        /* eslint-enable no-param-reassign */
    }

    /**
     * Counts set bits in `base` masked by `mask`.
     *
     * @param base Base option flags.
     * @param mask Mask to apply before counting.
     *
     * @returns Number of set bits in the masked value.
     */
    public static maskedBitCount(base: NetworkRuleOption, mask: NetworkRuleOption): number {
        return getBitCount(base.lo & mask.lo) + getBitCount(base.hi & mask.hi);
    }

    /**
     * Combines multiple options into one via bitwise OR.
     *
     * @param options Options to combine.
     *
     * @returns A new `{ lo, hi }` with all bits from all inputs.
     */
    public static combine(...options: NetworkRuleOption[]): NetworkRuleOption {
        let lo = 0;
        let hi = 0;
        for (const opt of options) {
            lo |= opt.lo;
            hi |= opt.hi;
        }
        return { lo, hi };
    }
}
