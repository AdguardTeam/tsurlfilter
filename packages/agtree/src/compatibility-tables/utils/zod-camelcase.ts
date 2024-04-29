// https://github.com/colinhacks/zod/issues/486#issuecomment-1501097361

import type zod from 'zod';
import camelCaseKeys from 'camelcase-keys';
import { type CamelCasedPropertiesDeep } from 'type-fest';

export const zodToCamelCase = <T extends zod.ZodTypeAny>(
    zod: T,
): zod.ZodEffects<zod.ZodTypeAny, CamelCasedPropertiesDeep<T['_output']>> => {
    return zod.transform((val) => camelCaseKeys(val) as CamelCasedPropertiesDeep<T>);
};
