/* eslint-disable no-bitwise */
import { type BaseCompatibilityDataSchema } from './schemas';
import { GenericPlatform, isGenericPlatform, type SpecificPlatform } from './platforms';
import { isUndefined } from '../utils/common';
import { type CompatibilityTable, type CompatibilityTableRow } from './types';

type ProductRecords<T> = {
    [key: string]: T
};

type RowByProduct<T> = {
    adg: ProductRecords<T>;
    ubo: ProductRecords<T>;
    abp: ProductRecords<T>;
};

type RowsByProduct<T> = RowByProduct<T>[];

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

    public existsAny(name: string): boolean {
        return !isUndefined(this.data.map[name]);
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

    public getEx(name: string, platform: SpecificPlatform | GenericPlatform): T[] {
        const data = this.getRowStorage(name);

        if (!data) {
            return [];
        }

        if (isGenericPlatform(platform)) {
            const result: T[] = [];
            const keys = Object.keys(data.map);

            for (let i = 0; i < keys.length; i += 1) {
                const key = Number(keys[i]);
                if (platform & key) {
                    const idx = data.map[key];
                    if (!isUndefined(idx)) {
                        result.push(data.shared[idx]);
                    }
                }
            }

            return result;
        }

        const idx = data.map[platform];
        return isUndefined(idx) ? [] : [data.shared[idx]];
    }

    public getRow(name: string): T[] {
        const data = this.getRowStorage(name);

        if (!data) {
            return [];
        }

        return data.shared;
    }

    public getRowsByProduct(): RowsByProduct<T> {
        const result: RowsByProduct<T> = [];

        for (let i = 0; i < this.data.shared.length; i += 1) {
            const data = this.data.shared[i];
            const keys = Object.keys(data.map);

            const row: RowByProduct<T> = {
                adg: {},
                ubo: {},
                abp: {},
            };

            for (let j = 0; j < keys.length; j += 1) {
                const key = Number(keys[j]);
                if (key & GenericPlatform.AdgAny) {
                    row.adg[key] = data.shared[data.map[key]];
                } else if (key & GenericPlatform.UboAny) {
                    row.ubo[key] = data.shared[data.map[key]];
                } else if (key & GenericPlatform.AbpAny) {
                    row.abp[key] = data.shared[data.map[key]];
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
