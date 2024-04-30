import { CompatibilityTableBase } from './base';
import { type ModifierDataSchema } from './schemas';
import { modifiersCompatibilityTableData } from './compatibility-table-data';
import { type SpecificPlatform, type GenericPlatform } from './platforms';
import { EMPTY, UNDERSCORE } from '../utils/constants';

class ModifiersCompatibilityTable extends CompatibilityTableBase<ModifierDataSchema> {
    public exists(name: string, platform: SpecificPlatform | GenericPlatform): boolean {
        // special case: the noop modifier can consist of any number of characters, e.g. '____' is also valid
        if (name.startsWith(UNDERSCORE)) {
            if (name.split(EMPTY).every((char) => char === UNDERSCORE)) {
                // in compatibility tables, we just store '_', so we need to reduce the number of underscores to 1
                // before checking the existence of the noop modifier
                return super.exists(UNDERSCORE, platform);
            }
        }

        return super.exists(name, platform);
    }

    // FIXME: handle noop modifier for get
}

export const modifiersCompatibilityTable = new ModifiersCompatibilityTable(modifiersCompatibilityTableData);
