/* eslint-disable no-bitwise */
import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import yaml from 'js-yaml';
import { readFileSync, readdirSync } from 'fs';

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

const getYmlFilesFromDir = (dir: string): string[] => {
    const dirEntries = readdirSync(dir, { withFileTypes: true });

    return dirEntries
        .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.yml'))
        .map((dirent) => dirent.name);
};

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

// note: we only run this when testing, before the build, compatibility tables should be pre-built
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

    return data;
};

const getModifiersCompatibilityTableData = (dir: string) => {
    return getCompatibilityTableData<ModifierDataSchema>(dir, baseFileSchema(modifierDataSchema));
};

const getRedirectsCompatibilityTableData = (dir: string) => {
    return getCompatibilityTableData<RedirectDataSchema>(dir, baseFileSchema(redirectDataSchema));
};

const getScriptletsCompatibilityTableData = (dir: string) => {
    return getCompatibilityTableData<ScriptletDataSchema>(dir, baseFileSchema(scriptletDataSchema));
};

export const scriptletsCompatibilityTableData = getScriptletsCompatibilityTableData(
    path.join(__dirname, './scriptlets'),
);

export const redirectsCompatibilityTableData = getRedirectsCompatibilityTableData(
    path.join(__dirname, './redirects'),
);

export const modifiersCompatibilityTableData = getModifiersCompatibilityTableData(
    path.join(__dirname, './modifiers'),
);
