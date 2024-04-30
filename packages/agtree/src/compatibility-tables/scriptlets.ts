import { CompatibilityTableBase } from './base';
import { type ScriptletDataSchema } from './schemas';
import { scriptletsCompatibilityTableData } from './compatibility-table-data';

class ScriptletsCompatibilityTable extends CompatibilityTableBase<ScriptletDataSchema> { }

export const scriptletsCompatibilityTable = new ScriptletsCompatibilityTable(scriptletsCompatibilityTableData);
