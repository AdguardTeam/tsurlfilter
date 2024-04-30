import yaml from 'js-yaml';
import { readFile } from 'fs/promises';

import { getActiveBitSlots, getYmlFilesFromDir } from './helpers';
import { type baseFileSchema, type BaseCompatibilityDataSchema } from './schemas';

// this is a helper structure to avoid storing the same data multiple times
// note: we never plan to export this, only use it internally
export interface MapWithSharedStorage<K extends string | number | symbol, V> {
    shared: V[];
    map: Record<K, number>;
}

export type CompatibilityTableRow<T> = MapWithSharedStorage<number, T>;

export type CompatibilityTable<T> = MapWithSharedStorage<string, CompatibilityTableRow<T>>;

// note: we only run this when testing, before the build, compatibility tables should be pre-built
export const getCompatibilityTableData = async <T extends BaseCompatibilityDataSchema>(
    dir: string,
    fileSchema: ReturnType<typeof baseFileSchema<T>>,
): Promise<CompatibilityTable<T>> => {
    const rawFiles = await getYmlFilesFromDir(dir);

    const parsedFileContents = await Promise.all(
        rawFiles.map(async (file) => {
            const rawFileContent = await readFile(`${dir}/${file}`, 'utf8');
            const fileData = yaml.load(rawFileContent);
            return fileSchema.parse(fileData);
        }),
    );

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
