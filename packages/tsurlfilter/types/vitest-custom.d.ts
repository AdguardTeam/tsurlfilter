/**
 * @file Custom types for Vitest to extend `expect` function with custom matchers.
 *
 * @see https://vitest.dev/guide/extending-matchers
 */
import 'vitest';

import { type CosmeticRule } from '../src/rules/cosmetic-rule';
import { type NetworkRule } from '../src/rules/network-rule';

declare module 'vitest' {
    // `T` is required to match Vitest's `Matchers<R, T>` interface for declaration merging.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R, T> {
        toMatchNetworkRule(expected: NetworkRule): R;
        toMatchCosmeticRule(expected: CosmeticRule): R;
    }
}
