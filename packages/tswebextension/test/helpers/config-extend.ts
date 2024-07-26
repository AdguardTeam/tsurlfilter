import merge from 'lodash-es/merge';

import { type ConfigurationMV2 } from '../../src/lib';

/**
 * Recursive partial type.
 *
 * @template T Type to make partial.
 *
 * @see {@link https://stackoverflow.com/a/51365037}
 */
export type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
        ? RecursivePartial<U>[]
        : T[P] extends object | undefined
            ? RecursivePartial<T[P]>
            : T[P];
};

/**
 * Extends base configuration with additional configuration.
 *
 * @param baseConfig Base configuration.
 * @param additionalConfig Additional configuration.
 * @returns Merged configuration.
 */
export const extendConfig = (
    baseConfig: ConfigurationMV2,
    additionalConfig?: RecursivePartial<ConfigurationMV2>,
): ConfigurationMV2 => {
    return merge({}, baseConfig, additionalConfig);
};
