/**
 * @file Compatibility tables for modifiers.
 */

import { CompatibilityTableBase } from './base';
import { type ModifierDataSchema } from './schemas';
import { modifiersCompatibilityTableData } from './compatibility-table-data';
import { UNDERSCORE } from '../utils/constants';
import { type CompatibilityTable } from './types';
import { deepFreeze } from '../utils/deep-freeze';
import { isValidNoopModifier } from '../utils/noop-modifier';

/**
 * Transforms the name of the modifier to a normalized form.
 * This is a special case: the noop modifier normally '_', but it can consist of any number of characters,
 * e.g. '____' is also valid. In this case, we need to normalize the name to '_'.
 *
 * @param name Modifier name to normalize.
 * @returns Normalized modifier name.
 */
const noopModifierNameNormalizer = (name: string): string => {
    if (name.startsWith(UNDERSCORE)) {
        if (isValidNoopModifier(name)) {
            // in compatibility tables, we just store '_', so we need to reduce the number of underscores to 1
            // before checking the existence of the noop modifier
            return UNDERSCORE;
        }
    }

    return name;
};

/**
 * Compatibility table for modifiers.
 */
class ModifiersCompatibilityTable extends CompatibilityTableBase<ModifierDataSchema> {
    /**
     * Creates a new instance of the compatibility table for modifiers.
     *
     * @param data Compatibility table data.
     */
    constructor(data: CompatibilityTable<ModifierDataSchema>) {
        super(data, noopModifierNameNormalizer);
    }
}

/**
 * Deep freeze the compatibility table data to avoid accidental modifications.
 */
deepFreeze(modifiersCompatibilityTableData);

/**
 * Compatibility table instance for modifiers.
 */
export const modifiersCompatibilityTable = new ModifiersCompatibilityTable(modifiersCompatibilityTableData);
