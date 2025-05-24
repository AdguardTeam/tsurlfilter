/**
 * @file Script to generate compatibility tables for the wiki.
 */

import * as prettier from 'prettier';
import { markdownTable } from 'markdown-table';
import { writeFile } from 'fs/promises';
import { ensureDir } from 'fs-extra';
import path from 'path';

import { redirectsCompatibilityTable } from '../src/compatibility-tables/redirects';
import { type BaseCompatibilityDataSchema } from '../src/compatibility-tables/schemas';
import { modifiersCompatibilityTable } from '../src/compatibility-tables/modifiers';
import { scriptletsCompatibilityTable } from '../src/compatibility-tables/scriptlets';
import { type ProductRecords, type RowByProduct, type CompatibilityTableBase } from '../src/compatibility-tables/base';
import { EMPTY, NEWLINE } from '../src/utils/constants.js';
import { AdblockSyntax } from '../src/utils/adblockers.js';
import { GenericPlatform, SpecificPlatform } from '../src/index.js';

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const WIKI_PATH = path.join(__dirname, '../src/compatibility-tables/wiki');

const LABELS = {
    AdGuard: ['CoreLibs', 'Chromium', 'Firefox', 'Safari CB', 'Android CB'],
    'uBlock Origin': ['Chromium', 'Firefox'],
    'Adblock Plus / AdBlock': ['Chromium', 'Firefox'],
};

type CompatibilityEntityData = Pick<BaseCompatibilityDataSchema, 'name' | 'aliases' | 'docs'>;

/**
 * Helper function to get the name with aliases, e.g. `name (alias1, alias2)`.
 *
 * @param data Compatibility data to get the name with aliases from.
 * @param html Whether to generate HTML or Markdown.
 *
 * @returns Name with aliases.
 */
const getNameWithAliases = (
    data: CompatibilityEntityData,
    html = false,
): string => {
    let { name } = data;

    if (data.docs) {
        name = html
            ? `<a href="${data.docs}">${name}</a>`
            : `[${name}](${data.docs})`;
    }

    if (data.aliases) {
        name += ` (${data.aliases.join(', ')})`;
    }

    return name;
};

/**
 * Helper function to get the first compatible entity from the row.
 *
 * @param row Row to get the first compatible entity from.
 * @param syntax Adblock syntax to get the entity from.
 * @param compatibility Compatibility flags to check.
 *
 * @returns First compatible entity from the row.
 */
const getFirstCompatibleEntityFromRow = <T extends BaseCompatibilityDataSchema>(
    row: RowByProduct<T>,
    syntax: typeof AdblockSyntax.Adg | typeof AdblockSyntax.Ubo | typeof AdblockSyntax.Abp,
    compatibility: SpecificPlatform | GenericPlatform,
): CompatibilityEntityData => {
    const productRow: ProductRecords<T> = row[syntax];
    for (const [key, value] of Object.entries(productRow)) {
        // eslint-disable-next-line no-bitwise
        if (Number(key) & compatibility) {
            return ({
                name: value.name,
                aliases: value.aliases,
                docs: value.docs,
            });
        }
    }

    return { name: EMPTY, aliases: null, docs: null };
};

/**
 * Sort function for the compatibility table.
 * It takes first (AdGuard) column as a base and moves empty cells to the end.
 *
 * @param a First row to compare.
 * @param b Second row to compare.
 *
 * @returns Comparison result.
 */
const sortFn = (a: CompatibilityEntityData[], b: CompatibilityEntityData[]) => {
    if (!a[0].name && !b[0].name) {
        return 0;
    }

    if (!a[0].name) {
        return 1;
    }

    if (!b[0].name) {
        return -1;
    }

    return a[0].name.localeCompare(b[0].name);
};

/**
 * Helper function to get the rows by product.
 *
 * @param data Compatibility data to get the rows by product from.
 * @param extended Whether to include extended compatibility information.
 *
 * @returns Rows by product.
 *
 * @template T Type of the compatibility data.
 */
const getRowsByProduct = <T extends CompatibilityTableBase<BaseCompatibilityDataSchema>>(
    data: T,
    extended = false,
): string[][] => {
    const result: CompatibilityEntityData[][] = extended
        ? data.getRowsByProduct().map((row) => [
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Adg, GenericPlatform.AdgOsAny),
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Adg, GenericPlatform.AdgExtChromium),
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Adg, SpecificPlatform.AdgExtFirefox),
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Adg, GenericPlatform.AdgSafariAny),
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Adg, SpecificPlatform.AdgCbAndroid),

            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Ubo, GenericPlatform.UboExtChromium),
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Ubo, SpecificPlatform.UboExtFirefox),

            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Abp, GenericPlatform.AbpExtChromium),
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Abp, SpecificPlatform.AbpExtFirefox),
        ])
        : data.getRowsByProduct().map((row) => [
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Adg, GenericPlatform.AdgAny),
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Ubo, GenericPlatform.UboAny),
            getFirstCompatibleEntityFromRow(row, AdblockSyntax.Abp, GenericPlatform.AbpAny),
        ]);

    return result.sort(sortFn).map((row) => row.map((cell) => getNameWithAliases(cell, extended)));
};

/**
 * Helper function to get the markdown file content.
 *
 * @param title Title of the markdown file.
 * @param table Markdown table content.
 *
 * @returns Markdown file content.
 */
const getMarkdownFileContent = (title: string, table: string): string => {
    return [
        // disable max line length and embedded HTML
        '<!-- markdownlint-disable MD013 MD033 -->',
        `# ${title}`,
        EMPTY,
        'This table is generated from the compatibility data.',
        EMPTY,
        table,
        EMPTY,
    ].join(NEWLINE);
};

/**
 * Helper function to get the markdown table content.
 *
 * @param bodyData Table body.
 * @param extended Whether to include extended compatibility information.
 *
 * @returns Markdown table content.
 */
const getTableContent = async (bodyData: string[][], extended = false): Promise<string> => {
    if (extended) {
        /* eslint-disable @typescript-eslint/indent */
        const header = `
            <thead>
                <tr>
                    ${Object.entries(LABELS)
                        .map(([mainLabel, subLabels]) => `<th colspan="${subLabels.length}">${mainLabel}</th>`)
                        .join(EMPTY)
                    }
                </tr>
                <tr>
                    ${Object.entries(LABELS)
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        .map(([_, subLabels]) => subLabels.map((subLabel) => `<th>${subLabel}</th>`).join(EMPTY))
                        .join(EMPTY)
                    }
                </tr>
            </thead>
        `;

        const tableBody = `
            <tbody>
                ${bodyData.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join(EMPTY)}</tr>`).join(EMPTY)}
            </tbody>
        `;
        /* eslint-enable @typescript-eslint/indent */

        return prettier.format(`<table>${header}${tableBody}</table>`, {
            parser: 'html',
        });
    }

    return markdownTable([
        Object.keys(LABELS),
        ...bodyData,
    ]);
};

/**
 * Helper function to write a markdown file.
 *
 * @param title Title of the markdown file.
 * @param compatibilityTable Compatibility table to write.
 * @param filePath File path to save the markdown file.
 * @param extended Whether to include extended compatibility information.
 */
const writeMarkdownFile = async <T extends CompatibilityTableBase<BaseCompatibilityDataSchema>>(
    title: string,
    compatibilityTable: T,
    filePath: string,
    extended = false,
) => {
    console.log(`Creating ${title}...`);

    const tableBody = getRowsByProduct(compatibilityTable, extended);
    const tableContent = await getTableContent(tableBody, extended);
    const markdownFileContent = getMarkdownFileContent(title, tableContent);

    await writeFile(filePath, markdownFileContent, 'utf8');
    console.log(`${title} has been saved to ${filePath}`);
};

/**
 * Main function.
 */
const main = async (): Promise<void> => {
    console.log('Building compatibility tables for the wiki...');

    console.log('Ensuring the wiki directory exists...');
    await ensureDir(WIKI_PATH);

    console.log('Generating compatibility tables...');

    await writeMarkdownFile(
        'Redirects Compatibility Table',
        redirectsCompatibilityTable,
        path.join(WIKI_PATH, 'redirects-compatibility-table.md'),
    );

    await writeMarkdownFile(
        'Modifiers Compatibility Table',
        modifiersCompatibilityTable,
        path.join(WIKI_PATH, 'modifiers-compatibility-table.md'),
    );

    await writeMarkdownFile(
        'Modifiers Compatibility Table',
        modifiersCompatibilityTable,
        path.join(WIKI_PATH, 'modifiers-compatibility-table-extended.md'),
        true,
    );

    await writeMarkdownFile(
        'Scriptlets Compatibility Table',
        scriptletsCompatibilityTable,
        path.join(WIKI_PATH, 'scriptlets-compatibility-table.md'),
    );
};

main();
