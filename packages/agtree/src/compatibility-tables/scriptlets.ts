/**
 * @file Compatibility tables for scriptlets.
 */

import { deepFreeze } from '../utils/deep-freeze';

import { CompatibilityTableBase } from './base';
import { scriptletsCompatibilityTableData } from './compatibility-table-data';
import { type ScriptletDataSchema } from './schemas';

/**
 * Compatibility table for scriptlets.
 */
class ScriptletsCompatibilityTable extends CompatibilityTableBase<ScriptletDataSchema> {}

/**
 * Deep freeze the compatibility table data to avoid accidental modifications.
 */
deepFreeze(scriptletsCompatibilityTableData);

/**
 * Compatibility table instance for scriptlets.
 */
export const scriptletsCompatibilityTable = new ScriptletsCompatibilityTable(
    scriptletsCompatibilityTableData,
);
