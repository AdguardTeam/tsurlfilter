import zod from 'zod';

import { zodToCamelCase } from '../utils/zod-camelcase';
import { baseCompatibilityDataSchema, baseRefineLogic } from './base';

const scriptletParameterSchema = zod.object({
    name: zod.string().min(1),
    required: zod.boolean(),
    description: zod.string().min(1).nullable().default(null),
    pattern: zod.string().min(1).nullable().default(null),
    default: zod.string().min(1).nullable().default(null),
    debug: zod.boolean().default(false),
});

const scriptletParametersSchema = zod.array(scriptletParameterSchema);

export const scriptletDataSchema = zodToCamelCase(
    baseCompatibilityDataSchema.extend({
        parameters: scriptletParametersSchema,
    }).superRefine(baseRefineLogic),
);

export type ScriptletDataSchema = zod.infer<typeof scriptletDataSchema>;
