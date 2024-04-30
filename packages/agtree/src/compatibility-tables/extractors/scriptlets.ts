import { getCompatibilityTableData } from './extractor';
import { type ScriptletDataSchema, baseFileSchema, scriptletDataSchema } from './schemas';

export const getScriptletsCompatibilityTableData = async (dir: string) => {
    return getCompatibilityTableData<ScriptletDataSchema>(dir, baseFileSchema(scriptletDataSchema));
};
