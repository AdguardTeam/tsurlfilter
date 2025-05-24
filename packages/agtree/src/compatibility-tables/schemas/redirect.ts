/**
 * @file Schema for redirect data.
 */

import zod from 'zod';

import { zodToCamelCase } from '../utils/zod-camelcase.js';
import { baseCompatibilityDataSchema, baseRefineLogic, booleanSchema } from './base.js';
import { resourceTypeSchema } from './resource-type.js';

/**
 * Zod schema for redirect data.
 */
export const redirectDataSchema = zodToCamelCase(baseCompatibilityDataSchema.extend({
    /**
     * Whether the redirect is blocking.
     */
    is_blocking: booleanSchema.default(false),

    /**
     * Resource type(s) belonging to the redirect.
     *
     * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ResourceType}
     */
    resource_types: zod.array(resourceTypeSchema).default([]),
}).superRefine(baseRefineLogic));

/**
 * Type of the redirect data schema.
 */
export type RedirectDataSchema = zod.infer<typeof redirectDataSchema>;
