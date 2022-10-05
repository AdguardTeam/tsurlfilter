import { z } from 'zod';
import { configurationValidator } from '../../common';

export const configurationMV2Validator = configurationValidator.extend({
    filters: z.object({
        filterId: z.number(),
        content: z.string(),
        trusted: z.boolean(),
    }).array(),
});

export type ConfigurationMV2 = z.infer<typeof configurationMV2Validator>;

export type ConfigurationMV2Context =
    & Omit<ConfigurationMV2, 'filters' | 'allowlist' | 'userrules' | 'trustedDomains'>
    & { filters: number[] };
