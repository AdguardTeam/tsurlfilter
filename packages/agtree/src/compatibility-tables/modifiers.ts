import { CompatibilityTableBase } from './base';
import { type ModifierDataSchema } from './extractors/schemas';
import { getModifiersCompatibilityTableData } from './extractors';

class ModifiersCompatibilityTable extends CompatibilityTableBase<ModifierDataSchema> { }

const data = await getModifiersCompatibilityTableData('./modifiers');

export const modifiersCompatibilityTable = new ModifiersCompatibilityTable(data);
