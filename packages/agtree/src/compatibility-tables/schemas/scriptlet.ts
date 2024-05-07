import zod from 'zod';

import { zodToCamelCase } from '../utils/zod-camelcase';
import { baseCompatibilityDataSchema, baseRefineLogic, booleanSchema } from './base';

const scriptletParameterSchema = zod.object({
    name: zod.string().min(1),
    required: booleanSchema,
    description: zod.string().min(1).nullable().default(null),
    pattern: zod.string().min(1).nullable().default(null),
    default: zod.string().min(1).nullable().default(null),
    debug: booleanSchema.default(false),
});

const scriptletParametersSchema = zod.array(scriptletParameterSchema);

export const scriptletDataSchema = zodToCamelCase(
    baseCompatibilityDataSchema.extend({
        parameters: scriptletParametersSchema.optional(),
    }).superRefine((data, ctx) => {
        // TODO: find something better, for now we can't add refine logic to the base schema:
        // https://github.com/colinhacks/zod/issues/454#issuecomment-848370721
        baseRefineLogic(data, ctx);

        // we don't allow required parameters after optional ones
        if (!data.parameters) {
            return;
        }

        let optionalFound = false;

        for (const parameter of data.parameters) {
            if (optionalFound && parameter.required) {
                ctx.addIssue({
                    code: zod.ZodIssueCode.custom,
                    message: 'Required parameters must be before optional ones',
                });
            }

            if (!parameter.required) {
                optionalFound = true;
            }
        }
    }),
);

export type ScriptletDataSchema = zod.infer<typeof scriptletDataSchema>;
