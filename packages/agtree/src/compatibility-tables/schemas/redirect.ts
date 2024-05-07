import zod from 'zod';

import { zodToCamelCase } from '../utils/zod-camelcase';
import { baseCompatibilityDataSchema, baseRefineLogic, booleanSchema } from './base';

export const redirectDataSchema = zodToCamelCase(baseCompatibilityDataSchema.extend({
    is_blocking: booleanSchema.default(false),
}).superRefine(baseRefineLogic));

export type RedirectDataSchema = zod.infer<typeof redirectDataSchema>;
