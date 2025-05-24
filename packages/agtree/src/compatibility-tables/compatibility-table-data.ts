/* eslint-disable no-bitwise,@typescript-eslint/naming-convention,no-underscore-dangle */
/**
 * @file Provides compatibility table data loading.
 */

import zod from 'zod';
import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import yaml from 'js-yaml';
import { readFileSync, readdirSync } from 'fs';
// Note: we use XRegExp as a dev dependency, but we do not include this compatibility table data loader
// in the production build, so it is safe to ignore ESLint warning here.
// eslint-disable-next-line import/no-extraneous-dependencies
import XRegExp from 'xregexp';

import { type CompatibilityTable, type CompatibilityTableRow } from './types.js';
import {
    type BaseCompatibilityDataSchema,
    baseFileSchema,
    modifierDataSchema,
    redirectDataSchema,
    scriptletDataSchema,
    type ModifierDataSchema,
    type RedirectDataSchema,
    type ScriptletDataSchema,
    KNOWN_VALIDATORS,
} from './schemas/index.js';
import { deepFreeze } from '../utils/deep-freeze.js';
import { EMPTY } from '../utils/constants.js';

const localDirname = path.dirname(new URL(import.meta.url).pathname);

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

        // If it is a known validator, we don't need to validate it further
        if (!valueFormatTrimmed && KNOWN_VALIDATORS.has(valueFormatTrimmed)) {
            return data;
        }

        // Create an XRegExp pattern from the value format, then convert it to a native RegExp pattern
        const xRegExpPattern = XRegExp(valueFormatTrimmed);
        const regExpPattern = new RegExp(xRegExpPattern.source, xRegExpPattern.flags);

        // If any flags are present in the pattern, we need to combine them with the existing flags

        // Note: we need 'value_format_flags' because RegExp constructor doesn't support flags in the pattern,
        // they should be passed as a separate argument, and perhaps this is the most convenient way to do it

        // Note: do not use 'regExpPattern.toString()' because it will include the slashes and flags and
        // you cannot create the equivalent RegExp object from it again
        if (regExpPattern.flags) {
            // 1. Get existing flags from 'value_format_flags'
            const flags: Set<string> = new Set();

            if (valueFormatFlags) {
                valueFormatFlags.split(EMPTY).forEach((flag) => flags.add(flag));
            }

            // 2. Add flags from the RegExp pattern
            regExpPattern.flags.split(EMPTY).forEach((flag) => flags.add(flag));

            // 3. Update 'value_format_flags' with the combined flags
            // eslint-disable-next-line no-param-reassign
            data.value_format_flags = Array.from(flags).join(EMPTY);
        }

        // eslint-disable-next-line no-param-reassign
        data.value_format = regExpPattern.source;

        return data;
    });

    const combinedSchema = valueFormatPreprocessorSchema.pipe(modifierDataSchema);

    const data = getCompatibilityTableData<ModifierDataSchema>(dir, baseFileSchema(combinedSchema));

    return data;
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
    path.resolve(localDirname, './scriptlets'),
);

/**
 * Compatibility table data for redirects.
 */
export const redirectsCompatibilityTableData = getRedirectsCompatibilityTableData(
    path.resolve(localDirname, './redirects'),
);

/**
 * Compatibility table data for modifiers.
 */
export const modifiersCompatibilityTableData = getModifiersCompatibilityTableData(
    path.resolve(localDirname, './modifiers'),
);
