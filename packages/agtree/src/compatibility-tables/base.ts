/* eslint-disable no-bitwise */
import { type BaseCompatibilityDataSchema } from './extractors/schemas';
import { type CompatibilityTableRow, type CompatibilityTable } from './extractors';
import { GenericPlatform, isGenericPlatform, type SpecificPlatform } from './platforms';
import { isUndefined } from '../utils/common';

type Rows<T> = { adguard: T[]; ublock: T[]; adblock: T[] }[];

export abstract class CompatibilityTableBase<T extends BaseCompatibilityDataSchema> {
    protected data: CompatibilityTable<T>;

    constructor(data: CompatibilityTable<T>) {
        this.data = data;
    }

    private getRowStorage(name: string): CompatibilityTableRow<T> | null {
        const idx = this.data.map[name];

        if (isUndefined(idx)) {
            return null;
        }

        return this.data.shared[idx];
    }

    public exists(name: string, platform: SpecificPlatform | GenericPlatform): boolean {
        const data = this.getRowStorage(name);

        if (!data) {
            return false;
        }

        if (isGenericPlatform(platform)) {
            // in this case, we can't index the platform directly,
            // instead, we need to iterate over the keys and check if the platform is supported
            const keys = Object.keys(data.map);
            for (let i = 0; i < keys.length; i += 1) {
                const key = Number(keys[i]);
                if (platform & key) {
                    const idx = data.map[key];
                    if (
                        !isUndefined(idx)
                        && (
                            data.shared[idx].name === name
                            || data.shared[idx].aliases?.includes(name)
                        )
                    ) {
                        return true;
                    }
                }
            }
        }

        const idx = data.map[platform];
        return !!(
            !isUndefined(idx)
            && (
                data.shared[idx].name === name
                || data.shared[idx].aliases?.includes(name)
            )
        );
    }

    public get(name: string, platform: SpecificPlatform): T | null {
        const data = this.getRowStorage(name);

        if (!data) {
            return null;
        }

        const idx = data.map[platform];
        return isUndefined(idx) ? null : data.shared[idx];
    }

    public getRow(name: string): T[] {
        const data = this.getRowStorage(name);

        if (!data) {
            return [];
        }

        return data.shared;
    }

    // FIXME: ugly
    public getRows(): Rows<T> {
        const result: Rows<T> = [];

        for (let i = 0; i < this.data.shared.length; i += 1) {
            const data = this.data.shared[i];
            const keys = Object.keys(data.map);

            const row = {
                adguard: [] as T[],
                ublock: [] as T[],
                adblock: [] as T[],
            };

            for (let j = 0; j < keys.length; j += 1) {
                const key = Number(keys[j]);
                if (key & GenericPlatform.AdgAny) {
                    row.adguard.push(data.shared[data.map[key]]);
                } else if (key & GenericPlatform.UboAny) {
                    row.ublock.push(data.shared[data.map[key]]);
                } else if (key & GenericPlatform.AbpAny) {
                    row.adblock.push(data.shared[data.map[key]]);
                }
            }

            result.push(row);
        }

        return result;
    }

    public getAll(platform: SpecificPlatform | GenericPlatform): T[] {
        const result: T[] = [];

        for (let i = 0; i < this.data.shared.length; i += 1) {
            const data = this.data.shared[i];
            const keys = Object.keys(data.map);

            if (isGenericPlatform(platform)) {
                for (let j = 0; j < keys.length; j += 1) {
                    const key = Number(keys[j]);
                    if (platform & key) {
                        result.push(data.shared[data.map[key]]);
                        break;
                    }
                }
            } else {
                const idx = data.map[platform];
                if (!isUndefined(idx)) {
                    result.push(data.shared[idx]);
                }
            }
        }

        return result;
    }
}
