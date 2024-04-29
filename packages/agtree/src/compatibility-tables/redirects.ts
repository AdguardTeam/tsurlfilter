import { CompatibilityTableBase } from './base';
import { type RedirectDataSchema } from './extractors/schemas';
import { getRedirectsCompatibilityTableData } from './extractors';

class RedirectsCompatibilityTable extends CompatibilityTableBase<RedirectDataSchema> { }

const data = await getRedirectsCompatibilityTableData('./redirects');

export const redirectsCompatibilityTable = new RedirectsCompatibilityTable(data);
