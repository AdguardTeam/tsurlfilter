// FIXME: organize these interfaces, splitted to avoid circular imports
import { z } from 'zod';

export const serializedRuleSetLazyDataValidator = z.strictObject({
    sourceMapRaw: z.string(),
    filterIds: z.number().array(),
});

export type SerializedRuleSetLazyData = z.infer<typeof serializedRuleSetLazyDataValidator>;

export const serializedRuleSetDataValidator = z.strictObject({
    regexpRulesCount: z.number(),
    rulesCount: z.number(),
    ruleSetHashMapRaw: z.string(),
    badFilterRulesRaw: z.string().array(),
});

export type SerializedRuleSetData = z.infer<typeof serializedRuleSetDataValidator>;
