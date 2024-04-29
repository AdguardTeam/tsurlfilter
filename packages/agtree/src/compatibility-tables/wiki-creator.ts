// eslint-disable-next-line import/no-extraneous-dependencies
import { markdownTable } from 'markdown-table';
import { writeFile } from 'fs/promises';

import { redirectsCompatibilityTable } from './redirects';
import { type BaseCompatibilityDataSchema } from './extractors/schemas';
import { modifiersCompatibilityTable } from './modifiers';

// FIXME: dirty code, needs refactoring

const tableHead = ['AdGuard', 'uBlock Origin', 'Adblock Plus / AdBlock'];
const redirectsTableBody: string[][] = [];
const modifiersTableBody: string[][] = [];

const getNameWithAliases = <T extends BaseCompatibilityDataSchema>(data: Pick<T, 'name' | 'aliases'>) => {
    let { name } = data;

    if (data.aliases) {
        name += ` (${data.aliases.join(', ')})`;
    }

    return name;
};

redirectsCompatibilityTable.getRows().forEach((row) => {
    const adgAliases = new Set<string>(row.adguard.map(getNameWithAliases));
    const uboAliases = new Set<string>(row.ublock.map(getNameWithAliases));
    const abAliases = new Set<string>(row.adblock.map(getNameWithAliases));

    // TODO: add links to docs
    redirectsTableBody.push([
        [...adgAliases].join(', '),
        [...uboAliases].join(', '),
        [...abAliases].join(', '),
    ]);
});

modifiersCompatibilityTable.getRows().forEach((row) => {
    const adgAliases = new Set<string>(row.adguard.map(getNameWithAliases));
    const uboAliases = new Set<string>(row.ublock.map(getNameWithAliases));
    const abAliases = new Set<string>(row.adblock.map(getNameWithAliases));

    // TODO: add links to docs
    modifiersTableBody.push([
        [...adgAliases].join(', '),
        [...uboAliases].join(', '),
        [...abAliases].join(', '),
    ]);
});

// order table by AdGuard (first column) - move empty cells to the end, and sort the rest
const sortFn = (a: string[], b: string[]) => {
    if (!a[0] && !b[0]) return 0;
    if (!a[0]) return 1;
    if (!b[0]) return -1;
    return a[0].localeCompare(b[0]);
};

redirectsTableBody.sort(sortFn);
modifiersTableBody.sort(sortFn);

const redirectsContent = [
    '<!-- markdownlint-disable MD013 -->',
    '# Redirects Compatibility Table',
    '',
    'This table is generated from the compatibility data.',
    '',
    markdownTable([tableHead, ...redirectsTableBody]),
    '',
].join('\n');

await writeFile('redirects-compatibility-table.md', redirectsContent, 'utf8');

const modifiersContent = [
    '<!-- markdownlint-disable MD013 -->',
    '# Modifiers Compatibility Table',
    '',
    'This table is generated from the compatibility data.',
    '',
    markdownTable([tableHead, ...modifiersTableBody]),
    '',
].join('\n');

await writeFile('modifiers-compatibility-table.md', modifiersContent, 'utf8');
