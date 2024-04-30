import { writeFile } from 'fs/promises';
import { ensureDir } from 'fs-extra';
import path from 'path';
import * as url from 'url';

import * as data from '../src/compatibility-tables/compatibility-table-data';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const outDir = path.join(__dirname, '../dist');
const outFile = path.join(outDir, 'compatibility-tables.json');

await ensureDir(outDir);
await writeFile(outFile, JSON.stringify(data, null, 2));

console.log(`Compatibility tables have been saved to ${outFile}`);
