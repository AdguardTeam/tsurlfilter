/* eslint-disable no-bitwise,@typescript-eslint/naming-convention,no-underscore-dangle */
/**
 * @file Provides compatibility table data loading.
 */

import path from 'path';
import yaml from 'js-yaml';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';

import { type CompatibilityTable, type CompatibilityTableRow } from './types';
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
import { deepFreeze } from '../utils/deep-freeze';

const __dirnameLocal = path.dirname(fileURLToPath(import.meta.url));

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
 * Gets active bit slots from a number, i.e. positions where bits are 1.
 *
 * @param n Number to get active bit slots from.
 *
 * @returns List of active bit slots.
 *
 * @example
 * ```ts
 * getActiveBitSlots(0b101) // => [1, 4]
 * ```
 */
const getActiveBitSlots = (n: number): number[] => {
    const result = [];

    for (let i = 0; i < 32; i += 1) {
        const p = n & (1 << i);
        if (p) {
            result.push(p);
        }
    }

    return result;
};

/**
 * Gets compatibility table data from a directory.
 *
 * @param dir Directory to get the compatibility table data from.
 * @param fileSchema File schema to parse the compatibility table data.
 *
 * @returns Compatibility table data.
 *
 * @template T Type of the compatibility data schema.
 *
 * @throws Error if the file is not found or cannot be read.
 *
 * @note We only run this when testing, before the build, compatibility tables should be pre-built
 * to `dist/compatibility-tables.json` to avoid unnecessary processing.
 *
 * @internal
 */
const getCompatibilityTableData = <T extends BaseCompatibilityDataSchema>(
    dir: string,
    fileSchema: ReturnType<typeof baseFileSchema<T>>,
): CompatibilityTable<T> => {
    const rawFiles = getYmlFilesFromDir(dir);

    const parsedFileContents = rawFiles.map((file) => {
        const rawFileContent = readFileSync(`${dir}/${file}`, 'utf8');
        const fileData = yaml.load(rawFileContent);
        return fileSchema.parse(fileData);
    });

    const data: CompatibilityTable<T> = {
        shared: [],
        map: {},
    };

    parsedFileContents.forEach((file) => {
        const aliases = new Set<string>();

        const fileData: CompatibilityTableRow<T> = {
            shared: [],
            map: {},
        };

        Object.entries(file).forEach(([platforms, value]) => {
            aliases.add(value.name);

            const fileAliases = value.aliases;

            if (fileAliases) {
                fileAliases.forEach((alias: string) => aliases.add(alias));
            }

            const activeBits = getActiveBitSlots(Number(platforms));

            fileData.shared.push(value as T);

            activeBits.forEach((activeBit) => {
                fileData.map[activeBit] = fileData.shared.length - 1;
            });
        });

        aliases.forEach((alias) => {
            data.map[alias] = data.shared.length;
        });

        data.shared.push(fileData);
    });

    return deepFreeze(data);
};

/**
 * Gets compatibility table data for modifiers.
 *
 * @param dir Directory to get the compatibility table data from.
 *
 * @returns Compatibility table data for modifiers.
 */
const getModifiersCompatibilityTableData = (dir: string) => {
    return getCompatibilityTableData<ModifierDataSchema>(dir, baseFileSchema(modifierDataSchema));
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
    path.resolve(__dirnameLocal, './scriptlets'),
);

/**
 * Compatibility table data for redirects.
 */
export const redirectsCompatibilityTableData = getRedirectsCompatibilityTableData(
    path.resolve(__dirnameLocal, './redirects'),
);

/**
 * Compatibility table data for modifiers.
 */
export const modifiersCompatibilityTableData = getModifiersCompatibilityTableData(
    path.resolve(__dirnameLocal, './modifiers'),
);
