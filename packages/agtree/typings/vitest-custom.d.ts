/**
 * @file Custom types for Vitest to extend `expect` function with custom matchers.
 *
 * @see https://vitest.dev/guide/extending-matchers
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import 'vitest';

import { type ToBeConvertedProperly } from '../test/setup/custom-matchers/check-conversion';

// Note: first argument is passed to `expect`, so we need to remove it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RemoveFirstArg<T> = T extends (arg0: any, ...args: infer U) => infer R ? (...args: U) => R : never;

declare module 'vitest' {
    // `R`/`T` are required to match Vitest's `Matchers<R, T>` interface for
    // declaration merging, and are otherwise unused by this matcher.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R, T> {
        toBeConvertedProperly: RemoveFirstArg<ToBeConvertedProperly>;
    }
}
