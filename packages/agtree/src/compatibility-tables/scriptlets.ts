/* eslint-disable no-bitwise */
/**
 * @file Compatibility tables for scriptlets.
 */

import { CompatibilityTableBase } from './base';
import { type ScriptletDataSchema } from './schemas';
import { scriptletsCompatibilityTableData } from './compatibility-table-data';
import { deepFreeze } from '../utils/deep-freeze';
import { type ValidationContext } from './validators/types';

/**
 * Scriptlet syntax type.
 */
export type ScriptletSyntax = 'adg' | 'ubo' | 'abp';

/**
 * Compatibility table for scriptlets.
 */
class ScriptletsCompatibilityTable extends CompatibilityTableBase<ScriptletDataSchema> {
    /**
     * Validates a scriptlet against the compatibility table.
     *
     * TODO: implement scriptlet validation.
     *
     * @param _data Scriptlet as string (to be parsed) or already parsed ScriptletInjectionRuleBody node.
     * @param _ctx Validation context to collect issues into.
     */
    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
    public validate(_data: string, _ctx: ValidationContext): void {
        // TODO: implement scriptlet validation
    }
}

/**
 * Deep freeze the compatibility table data to avoid accidental modifications.
 */
deepFreeze(scriptletsCompatibilityTableData);

/**
 * Compatibility table instance for scriptlets.
 */
export const scriptletsCompatibilityTable = new ScriptletsCompatibilityTable(scriptletsCompatibilityTableData);
