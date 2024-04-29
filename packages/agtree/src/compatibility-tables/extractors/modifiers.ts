import { getCompatibilityTableData } from './extractor';
import { baseFileSchema, modifierDataSchema, type ModifierDataSchema } from './schemas';

export const getModifiersCompatibilityTableData = async (dir: string) => {
    return getCompatibilityTableData<ModifierDataSchema>(dir, baseFileSchema(modifierDataSchema));
};
