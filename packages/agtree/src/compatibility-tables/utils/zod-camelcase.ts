/**
 * @file Zod camelCase utility.
 */

import type zod from 'zod';
import camelCaseKeys from 'camelcase-keys';
import { type CamelCasedPropertiesDeep } from 'type-fest';

/**
 * Transforms Zod schema to camelCase.
 *
 * @param zod Zod schema.
 *
 * @returns Zod schema with camelCase properties.
 *
 * @see {@link https://github.com/colinhacks/zod/issues/486#issuecomment-1501097361}
 */
export const zodToCamelCase = <T extends zod.ZodTypeAny>(
    zod: T,
): zod.ZodEffects<zod.ZodTypeAny, CamelCasedPropertiesDeep<T['_output']>> => {
    return zod.transform((val) => camelCaseKeys(val) as CamelCasedPropertiesDeep<T>);
};
