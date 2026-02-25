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
import { type CompatibilityTableBase } from '../src/compatibility-tables/base';
import { EMPTY, NEWLINE } from '../src/utils/constants';
import { Platform } from '../src/compatibility-tables/platform';

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
 * Helper function to get the first compatible entity for a platform.
 *
 * @param table Compatibility table to query.
 * @param featureName Name of the feature to query.
 * @param platform Platform to check compatibility for.
 *
 * @returns First compatible entity data or empty.
 */
const getFirstCompatibleEntity = <T extends BaseCompatibilityDataSchema>(
    table: CompatibilityTableBase<T>,
    featureName: string,
    platform: Platform,
): CompatibilityEntityData => {
    // Use query() which supports both specific and wildcard platforms
    const result = table.query(featureName, platform);

    if (result) {
        return {
            name: result.name,
            aliases: result.aliases,
            docs: result.docs,
        };
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
 * @param table Compatibility table to get the rows from.
 * @param extended Whether to include extended compatibility information.
 *
 * @returns Rows by product.
 *
 * @template T Type of the compatibility data.
 */
const getRowsByProduct = <T extends CompatibilityTableBase<BaseCompatibilityDataSchema>>(
    table: T,
    extended = false,
): string[][] => {
    // Get all unique feature names across all products
    const grouped = table.groupByProduct();

    // Collect all unique features across all products
    // Use a Map to deduplicate by the actual data content (same feature, different names across products)
    const seenFeatures = new Map<string, Set<string>>();
    const allFeatureNames = new Set<string>();

    for (const [, featureMap] of grouped.entries()) {
        for (const [featureName, dataArray] of featureMap.entries()) {
            if (dataArray.length > 0) {
                const canonicalName = dataArray[0].name;

                // Track which feature names map to this canonical name
                if (!seenFeatures.has(canonicalName)) {
                    seenFeatures.set(canonicalName, new Set());
                    allFeatureNames.add(featureName); // Use first encountered name
                }
                seenFeatures.get(canonicalName)!.add(featureName);
            }
        }
    }

    const result: CompatibilityEntityData[][] = [];

    for (const featureName of allFeatureNames) {
        if (extended) {
            result.push([
                getFirstCompatibleEntity(table, featureName, Platform.AdgOsAny),
                getFirstCompatibleEntity(table, featureName, Platform.AdgExtChrome),
                getFirstCompatibleEntity(table, featureName, Platform.AdgExtFirefox),
                getFirstCompatibleEntity(table, featureName, Platform.AdgCbIos),
                getFirstCompatibleEntity(table, featureName, Platform.AdgCbAndroid),

                getFirstCompatibleEntity(table, featureName, Platform.UboExtChrome),
                getFirstCompatibleEntity(table, featureName, Platform.UboExtFirefox),

                getFirstCompatibleEntity(table, featureName, Platform.AbpExtChrome),
                getFirstCompatibleEntity(table, featureName, Platform.AbpExtFirefox),
            ]);
        } else {
            result.push([
                getFirstCompatibleEntity(table, featureName, Platform.AdgAny),
                getFirstCompatibleEntity(table, featureName, Platform.UboAny),
                getFirstCompatibleEntity(table, featureName, Platform.AbpAny),
            ]);
        }
    }

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
