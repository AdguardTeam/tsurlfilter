/**
 * @file Schema for redirect data.
 */

import type zod from 'zod';

import { zodToCamelCase } from '../utils/zod-camelcase';
import { baseCompatibilityDataSchema, baseRefineLogic, booleanSchema } from './base';

/**
 * Zod schema for redirect data.
 */
export const redirectDataSchema = zodToCamelCase(baseCompatibilityDataSchema.extend({
    /**
     * Whether the redirect is blocking.
     */
    is_blocking: booleanSchema.default(false),
}).superRefine(baseRefineLogic));

/**
 * Type of the redirect data schema.
 */
export type RedirectDataSchema = zod.infer<typeof redirectDataSchema>;
