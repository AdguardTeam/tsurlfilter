/**
 * @file Schema for scriptlet data.
 */

import zod from 'zod';

import { zodToCamelCase } from '../utils/zod-camelcase.js';
import {
    baseCompatibilityDataSchema,
    baseRefineLogic,
    booleanSchema,
    nonEmptyStringSchema,
} from './base.js';

/**
 * Zod schema for scriptlet parameter data.
 */
const scriptletParameterSchema = zod.object({
    /**
     * Name of the actual parameter.
     */
    name: nonEmptyStringSchema,

    /**
     * Describes whether the parameter is required. Empty parameters are not allowed.
     */
    required: booleanSchema,

    /**
     * Short description of the parameter.
     * If not specified or it's value is `null`,then the description is not available.
     */
    description: nonEmptyStringSchema.nullable().default(null),

    /**
     * Regular expression that matches the value of the parameter.
     * If it's value is `null`, then the parameter value is not checked.
     */
    pattern: nonEmptyStringSchema.nullable().default(null),

    /**
     * Default value of the parameter (if any).
     */
    default: nonEmptyStringSchema.nullable().default(null),

    /**
     * Describes whether the parameter is used only for debugging purposes.
     */
    debug: booleanSchema.default(false),
});

/**
 * Zod schema for scriptlet parameters.
 */
const scriptletParametersSchema = zod.array(scriptletParameterSchema);

/**
 * Zod schema for scriptlet data.
 */
export const scriptletDataSchema = zodToCamelCase(
    baseCompatibilityDataSchema.extend({
        /**
         * List of parameters that the scriptlet accepts.
         * **Every** parameter should be listed here, because we check that the scriptlet is used correctly
         * (e.g. that the number of parameters is correct).
         */
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

/**
 * Type of the scriptlet data schema.
 */
export type ScriptletDataSchema = zod.infer<typeof scriptletDataSchema>;
