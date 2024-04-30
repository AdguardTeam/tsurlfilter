// eslint-disable-next-line import/no-extraneous-dependencies
import { markdownTable } from 'markdown-table';
import { writeFile } from 'fs/promises';
import { ensureDirSync } from 'fs-extra';
import path from 'path';

import { redirectsCompatibilityTable } from '../src/compatibility-tables/redirects';
import { type BaseCompatibilityDataSchema } from '../src/compatibility-tables/schemas';
import { modifiersCompatibilityTable } from '../src/compatibility-tables/modifiers';
import { scriptletsCompatibilityTable } from '../src/compatibility-tables/scriptlets';

const main = async (): Promise<void> => {
    ensureDirSync(path.join(__dirname, '../src/compatibility-tables/wiki'));

    // FIXME: dirty code, needs refactoring

    const tableHead = ['AdGuard', 'uBlock Origin', 'Adblock Plus / AdBlock'];
    const redirectsTableBody: string[][] = [];
    const modifiersTableBody: string[][] = [];
    const scriptletsTableBody: string[][] = [];

    const getNameWithAliases = <T extends BaseCompatibilityDataSchema>(data: Pick<T, 'name' | 'aliases' | 'docs'>) => {
        let { name } = data;

        if (data.docs) {
            name = `[${name}](${data.docs})`;
        }

        if (data.aliases) {
            name += ` (${data.aliases.join(', ')})`;
        }

        return name;
    };

    redirectsCompatibilityTable.getRowsByProduct().forEach((row) => {
        const adgAliases = new Set<string>(Object.values(row.adg).map(getNameWithAliases));
        const uboAliases = new Set<string>(Object.values(row.ubo).map(getNameWithAliases));
        const abAliases = new Set<string>(Object.values(row.abp).map(getNameWithAliases));

        redirectsTableBody.push([
            [...adgAliases].join(', '),
            [...uboAliases].join(', '),
            [...abAliases].join(', '),
        ]);
    });

    modifiersCompatibilityTable.getRowsByProduct().forEach((row) => {
        const adgAliases = new Set<string>(Object.values(row.adg).map(getNameWithAliases));
        const uboAliases = new Set<string>(Object.values(row.ubo).map(getNameWithAliases));
        const abAliases = new Set<string>(Object.values(row.abp).map(getNameWithAliases));

        modifiersTableBody.push([
            [...adgAliases].join(', '),
            [...uboAliases].join(', '),
            [...abAliases].join(', '),
        ]);
    });

    scriptletsCompatibilityTable.getRowsByProduct().forEach((row) => {
        const adgAliases = new Set<string>(Object.values(row.adg).map(getNameWithAliases));
        const uboAliases = new Set<string>(Object.values(row.ubo).map(getNameWithAliases));
        const abAliases = new Set<string>(Object.values(row.abp).map(getNameWithAliases));

        scriptletsTableBody.push([
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
    scriptletsTableBody.sort(sortFn);

    const redirectsContent = [
        '<!-- markdownlint-disable MD013 -->',
        '# Redirects Compatibility Table',
        '',
        'This table is generated from the compatibility data.',
        '',
        markdownTable([tableHead, ...redirectsTableBody]),
        '',
    ].join('\n');

    const redirectsWikiPath = path.join(__dirname, '../src/compatibility-tables/wiki/redirects-compatibility-table.md');
    await writeFile(redirectsWikiPath, redirectsContent, 'utf8');
    console.log(`Redirects compatibility table has been saved to ${redirectsWikiPath}`);

    const modifiersContent = [
        '<!-- markdownlint-disable MD013 -->',
        '# Modifiers Compatibility Table',
        '',
        'This table is generated from the compatibility data.',
        '',
        markdownTable([tableHead, ...modifiersTableBody]),
        '',
    ].join('\n');

    const modifiersWikiPath = path.join(__dirname, '../src/compatibility-tables/wiki/modifiers-compatibility-table.md');
    await writeFile(modifiersWikiPath, modifiersContent, 'utf8');
    console.log(`Modifiers compatibility table has been saved to ${modifiersWikiPath}`);

    const scriptletsContent = [
        '<!-- markdownlint-disable MD013 -->',
        '# Scriptlets Compatibility Table',
        '',
        'This table is generated from the compatibility data.',
        '',
        markdownTable([tableHead, ...scriptletsTableBody]),
        '',
    ].join('\n');

    // eslint-disable-next-line max-len
    const scriptletsWikiPath = path.join(__dirname, '../src/compatibility-tables/wiki/scriptlets-compatibility-table.md');
    await writeFile(scriptletsWikiPath, scriptletsContent, 'utf8');
    console.log(`Scriptlets compatibility table has been saved to ${scriptletsWikiPath}`);
};

main();
