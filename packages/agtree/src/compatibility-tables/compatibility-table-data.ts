/**
 * @file Compatibility table data loading with hybrid trie structure.
 */

import path, { dirname } from 'path';
import { readFileSync, readdirSync } from 'fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import yaml from 'js-yaml';
// eslint-disable-next-line import/no-extraneous-dependencies
import XRegExp from 'xregexp';
import zod from 'zod';
import { fileURLToPath } from 'url';

import { type HybridCompatibilityTableRow, type CompatibilityTable } from './types';
import { TrieNode } from './trie';
import { PlatformExpressionEvaluator } from './platform-expression-evaluator';
import {
    type BaseCompatibilityDataSchema,
    baseFileSchema,
    modifierDataSchema,
    redirectDataSchema,
    scriptletDataSchema,
    type ModifierDataSchema,
    type RedirectDataSchema,
    type ScriptletDataSchema,
} from './schemas';
import { KNOWN_VALIDATORS } from './validators';
import { deepFreeze } from '../utils/deep-freeze';
import { EMPTY } from '../utils/constants';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Gets all `.yml` files from a directory.
 *
 * @param dir Directory to get the `.yml` files from.
 *
 * @returns List of `.yml` files or an empty list if no files found.
 */
const getYmlFilesFromDir = (dir: string): string[] => {
    const dirEntries = readdirSync(dir, { withFileTypes: true });

    return dirEntries
        .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.yml'))
        .map((dirent) => dirent.name);
};

/**
 * Builds a hybrid compatibility table row from parsed YAML data.
 * Creates both a trie for wildcard queries and a flat map for O(1) specific lookups.
 * Supports multiple platforms in a single key with negation (e.g., 'adg_os_any|~adg_os_windows').
 *
 * @param fileData Parsed YAML data (platform string/expression → data).
 *
 * @returns Hybrid compatibility table row.
 *
 * @template T Type of the compatibility data schema.
 */
const buildHybridRow = <T extends BaseCompatibilityDataSchema>(
    fileData: Record<string, T>,
): HybridCompatibilityTableRow<T> => {
    const trie = new TrieNode<T>();
    const flatMap = new Map<string, T>();
    const shared: T[] = [];

    // Insert each platform's data into both structures
    for (const [platformExpr, data] of Object.entries(fileData)) {
        // Always use evaluator to expand wildcards to concrete platforms
        // This handles: single concrete platforms, wildcards (adg_any), negation (~adg_os_windows)
        const platforms = PlatformExpressionEvaluator.evaluate(platformExpr);

        // Insert data for each concrete platform
        for (const platform of platforms) {
            const platformStr = platform.toString();
            const platformPath = platform.toPath();

            // Insert into trie (for wildcard queries)
            trie.insert(platformPath, data);

            // Insert into flat map (for O(1) specific lookups)
            flatMap.set(platformStr, data);
        }

        // Add to shared storage once per entry (not per platform)
        shared.push(data);
    }

    return {
        trie,
        flatMap,
        shared,
    };
};

/**
 * Gets compatibility table data from a directory using hybrid structure.
 *
 * @param dir Directory to get the compatibility table data from.
 * @param fileSchema File schema to parse the compatibility table data.
 *
 * @returns Compatibility table data with hybrid structure.
 *
 * @template T Type of the compatibility data schema.
 *
 * @throws Error if the file is not found or cannot be read.
 */
const getCompatibilityTableData = <T extends BaseCompatibilityDataSchema>(
    dir: string,
    fileSchema: ReturnType<typeof baseFileSchema<T>>,
): CompatibilityTable<T> => {
    const rawFiles = getYmlFilesFromDir(dir);

    const rows = new Map<string, HybridCompatibilityTableRow<T>>();

    for (const file of rawFiles) {
        const rawFileContent = readFileSync(`${dir}/${file}`, 'utf8');
        const fileData = yaml.load(rawFileContent);
        const parsedData = fileSchema.parse(fileData);

        // Extract feature name from file (remove .yml extension)
        const featureName = file.replace(/\.yml$/, '');

        // Build hybrid row
        const row = buildHybridRow(parsedData);

        // Store by feature name (filename without .yml)
        rows.set(featureName, row);

        // Also index by the actual name and aliases from entries
        for (const entry of Object.values(parsedData)) {
            // Index by name field
            if (entry?.name && entry.name !== featureName) {
                rows.set(entry.name, row);
            }
            // Index by aliases
            if (entry?.aliases) {
                for (const alias of entry.aliases) {
                    rows.set(alias, row);
                }
            }
        }
    }

    return deepFreeze({
        rows,
    });
};

/**
 * Gets compatibility table data for modifiers.
 *
 * @param dir Directory to get the compatibility table data from.
 *
 * @returns Compatibility table data for modifiers.
 */
const getModifiersCompatibilityTableData = (dir: string) => {
    const valueFormatPreprocessorSchema = zod.object({
        value_format: zod.optional(zod.string()),
        value_format_flags: zod.optional(zod.string()),
    }).passthrough().transform((data) => {
        const {
            value_format: valueFormat,
            value_format_flags: valueFormatFlags,
        } = data;

        if (!valueFormat) {
            return data;
        }

        const valueFormatTrimmed = valueFormat.trim();

        if (!valueFormatTrimmed && KNOWN_VALIDATORS.has(valueFormatTrimmed)) {
            return data;
        }

        const xRegExpPattern = XRegExp(valueFormatTrimmed);
        const regExpPattern = new RegExp(xRegExpPattern.source, xRegExpPattern.flags);

        if (regExpPattern.flags) {
            const flags: Set<string> = new Set();

            if (valueFormatFlags) {
                valueFormatFlags.split(EMPTY).forEach((flag) => flags.add(flag));
            }

            regExpPattern.flags.split(EMPTY).forEach((flag) => flags.add(flag));

            // eslint-disable-next-line no-param-reassign
            data.value_format_flags = Array.from(flags).join(EMPTY);
        }

        // eslint-disable-next-line no-param-reassign
        data.value_format = regExpPattern.source;

        return data;
    });

    const combinedSchema = valueFormatPreprocessorSchema.pipe(modifierDataSchema);

    return getCompatibilityTableData<ModifierDataSchema>(dir, baseFileSchema(combinedSchema));
};

/**
 * Gets compatibility table data for redirects.
 *
 * @param dir Directory to get the compatibility table data from.
 *
 * @returns Compatibility table data for redirects.
 */
const getRedirectsCompatibilityTableData = (dir: string) => {
    return getCompatibilityTableData<RedirectDataSchema>(dir, baseFileSchema(redirectDataSchema));
};

/**
 * Gets compatibility table data for scriptlets.
 *
 * @param dir Directory to get the compatibility table data from.
 *
 * @returns Compatibility table data for scriptlets.
 */
const getScriptletsCompatibilityTableData = (dir: string) => {
    return getCompatibilityTableData<ScriptletDataSchema>(dir, baseFileSchema(scriptletDataSchema));
};

/**
 * Compatibility table data for scriptlets.
 */
export const scriptletsCompatibilityTableData = getScriptletsCompatibilityTableData(
    path.resolve(__dirname, './scriptlets'),
);

/**
 * Compatibility table data for redirects.
 */
export const redirectsCompatibilityTableData = getRedirectsCompatibilityTableData(
    path.resolve(__dirname, './redirects'),
);

/**
 * Compatibility table data for modifiers.
 */
export const modifiersCompatibilityTableData = getModifiersCompatibilityTableData(
    path.resolve(__dirname, './modifiers'),
);
