/**
 * @file Compatibility tables for scriptlets.
 */

import { CompatibilityTableBase } from './base.js';
import { type ScriptletDataSchema } from './schemas/index.js';
import { scriptletsCompatibilityTableData } from './compatibility-table-data.js';
import { deepFreeze } from '../utils/deep-freeze.js';

/**
 * Compatibility table for scriptlets.
 */
class ScriptletsCompatibilityTable extends CompatibilityTableBase<ScriptletDataSchema> { }

/**
 * Deep freeze the compatibility table data to avoid accidental modifications.
 */
deepFreeze(scriptletsCompatibilityTableData);

/**
 * Compatibility table instance for scriptlets.
 */
export const scriptletsCompatibilityTable = new ScriptletsCompatibilityTable(scriptletsCompatibilityTableData);
