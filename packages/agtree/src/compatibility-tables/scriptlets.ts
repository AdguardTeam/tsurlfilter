import { CompatibilityTableBase } from './base';
import { type ScriptletDataSchema } from './extractors/schemas';
import { getScriptletsCompatibilityTableData } from './extractors';

class ScriptletsCompatibilityTable extends CompatibilityTableBase<ScriptletDataSchema> { }

const data = await getScriptletsCompatibilityTableData('./scriptlets');

export const scriptletsCompatibilityTable = new ScriptletsCompatibilityTable(data);
