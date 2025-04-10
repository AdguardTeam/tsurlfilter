/**
 * @file Custom types for Vitest to extend `expect` function with custom matchers.
 *
 * @see https://vitest.dev/guide/extending-matchers#extending-matchers
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import 'vitest';

import { type ToBeConvertedProperly } from '../test/setup/custom-matchers/check-conversion';
import { type ToBeSerializedAndDeserializedProperly } from '../test/setup/custom-matchers/check-serialization';

// Note: first argument is passed to `expect`, so we need to remove it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RemoveFirstArg<T> = T extends (arg0: any, ...args: infer U) => infer R ? (...args: U) => R : never;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface CustomMatchers<R = unknown> {
    toBeConvertedProperly: RemoveFirstArg<ToBeConvertedProperly>;

    toBeSerializedAndDeserializedProperly: RemoveFirstArg<ToBeSerializedAndDeserializedProperly>;
}

declare module 'vitest' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-explicit-any
    interface Assertion<T = any> extends CustomMatchers<T> {}
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface AsymmetricMatchersContaining extends CustomMatchers {}
}
