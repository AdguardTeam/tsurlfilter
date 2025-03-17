/**
 * @file Custom types for Vitest to extend `expect` function with custom matchers.
 *
 * @see https://vitest.dev/guide/extending-matchers#extending-matchers
 */
import 'vitest';

interface CustomMatchers<R = unknown> {
    toMatchNetworkRule(expected: R): R;
    toMatchCosmeticRule(expected: R): R;
}

declare module 'vitest' {
    interface Assertion<T = any> extends CustomMatchers<T> {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
}
