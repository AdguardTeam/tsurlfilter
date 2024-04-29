// eslint-disable-next-line import/no-extraneous-dependencies
import { markdownTable } from 'markdown-table';
import { writeFile } from 'fs/promises';

import { redirectsCompatibilityTable } from './redirects';
import { type RedirectDataSchema } from './extractors/schemas';

const tableHead = ['AdGuard', 'uBlock Origin', 'AdBlock Plus / AdBlock'];
const tableBody: string[][] = [];

const getRedirectNames = (data: Pick<RedirectDataSchema, 'name' | 'aliases'>) => {
    let { name } = data;

    if (data.aliases) {
        name += ` (${data.aliases.join(', ')})`;
    }

    return name;
};

redirectsCompatibilityTable.getRows().forEach((row) => {
    const adgAliases = new Set<string>(row.adguard.map(getRedirectNames));
    const uboAliases = new Set<string>(row.ublock.map(getRedirectNames));
    const abAliases = new Set<string>(row.adblock.map(getRedirectNames));

    // TODO: add links to docs
    tableBody.push([
        [...adgAliases].join(', '),
        [...uboAliases].join(', '),
        [...abAliases].join(', '),
    ]);
});

// order table by AdGuard (first column) - move empty cells to the end, and sort the rest
tableBody.sort((a, b) => {
    if (!a[0] && !b[0]) return 0;
    if (!a[0]) return 1;
    if (!b[0]) return -1;
    return a[0].localeCompare(b[0]);
});

const table = markdownTable([tableHead, ...tableBody]);

const content = [
    '<!-- markdownlint-disable MD013 -->',
    '# Redirects Compatibility Table',
    '',
    'This table is generated from the compatibility data.',
    '',
    table,
    '',
].join('\n');

await writeFile('redirects-compatibility-table.md', content, 'utf8');
