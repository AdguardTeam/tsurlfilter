/**
 * @file Zod camelCase utility.
 */

import camelCaseKeys from 'camelcase-keys';
import { type CamelCasedPropertiesDeep } from 'type-fest';
import type zod from 'zod';

/**
 * Transforms Zod schema to camelCase.
 *
 * @see {@link https://github.com/colinhacks/zod/issues/486#issuecomment-1501097361}
 *
 * @param zod Zod schema.
 *
 * @returns Zod schema with camelCase properties.
 */
export const zodToCamelCase = <T extends zod.ZodTypeAny>(
    zod: T,
): zod.ZodEffects<zod.ZodTypeAny, CamelCasedPropertiesDeep<T['_output']>> => {
    return zod.transform((val) => camelCaseKeys(val) as CamelCasedPropertiesDeep<T>);
};
