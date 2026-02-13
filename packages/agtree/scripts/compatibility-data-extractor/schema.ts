import * as v from 'valibot';

/**
 * Schema for a scriptlet parameter.
 */
export const scriptletParameterSchema = v.object({
    name: v.string(),
    type: v.optional(v.string()),
    required: v.optional(v.boolean()),
    defaultValue: v.optional(v.string()),
    description: v.optional(v.string()),
});

/**
 * Schema for a scriptlet.
 */
export const scriptletSchema = v.object({
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    context: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    parameters: v.optional(v.array(scriptletParameterSchema)),
    since: v.optional(v.string()),
});

/**
 * Schema for an array of scriptlets.
 */
export const scriptletsSchema = v.array(scriptletSchema);

/**
 * TypeScript type for a scriptlet parameter.
 */
export type ScriptletParameter = v.InferOutput<typeof scriptletParameterSchema>;

/**
 * TypeScript type for a scriptlet.
 */
export type Scriptlet = v.InferOutput<typeof scriptletSchema>;

/**
 * TypeScript type for an array of scriptlets.
 */
export type Scriptlets = v.InferOutput<typeof scriptletsSchema>;
