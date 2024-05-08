/* eslint-disable no-bitwise */
import { type BaseCompatibilityDataSchema } from './schemas';
import { GenericPlatform, type SpecificPlatform } from './platforms';
import { isUndefined } from '../utils/common';
import { type CompatibilityTable, type CompatibilityTableRow } from './types';
import { isGenericPlatform, getSpecificPlatformName } from './utils/platform-helpers';

type ProductRecords<T> = {
    [key: string]: T
};

type SinglePlatformRecords<T> = {
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

    /**
     * Checks whether a compatibility data `name` exists for any platform.
     *
     * @note Technically, do the same as `exists()` method with generic platform _any_
     * but it is faster because it does not apply complex logic.
     *
     * @param name Compatibility data name.
     *
     * @returns True if the compatibility data exists, false otherwise.
     */
    public existsAny(name: string): boolean {
        return !isUndefined(this.data.map[name]);
    }

    /**
     * Checks whether a compatibility data `name` exists for a specified platform.
     *
     * @param name Compatibility data name.
     * @param platform Specific or generic platform.
     *
     * @returns True if the compatibility data exists, false otherwise.
     */
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
                    if (isUndefined(idx)) {
                        continue;
                    }

                    if (
                        data.shared[idx].name === name
                        || data.shared[idx].aliases?.includes(name)
                    ) {
                        return true;
                    }
                }
            }
        }

        const idx = data.map[platform];
        if (isUndefined(idx)) {
            return false;
        }

        return data.shared[idx].name === name || !!data.shared[idx].aliases?.includes(name);
    }

    /**
     * Returns a compatibility data by name and specific platform.
     *
     * @param name The name of the compatibility data.
     * @param platform The specific platform.
     *
     * @returns A single compatibility data or `null` if not found.
     */
    public getSingle(name: string, platform: SpecificPlatform): T | null {
        const data = this.getRowStorage(name);

        if (!data) {
            return null;
        }

        const idx = data.map[platform];
        return isUndefined(idx) ? null : data.shared[idx];
    }

    /**
     * Returns all compatibility data records for name and specified platform.
     *
     * @param name Compatibility data name.
     * @param platform Specific or generic platform.
     *
     * @returns Multiple records grouped by platforms.
     * Technically, it is an object where keys are platform enums values and values are compatibility data records.
     *
     * @note Platform enum values can be converted to string names using {@link getSpecificPlatformName} on demand.
     */
    public getMultiple(name: string, platform: SpecificPlatform | GenericPlatform): SinglePlatformRecords<T> | null {
        const data = this.getRowStorage(name);

        if (!data) {
            return null;
        }

        if (isGenericPlatform(platform)) {
            const result: SinglePlatformRecords<T> = {};
            const keys = Object.keys(data.map);

            for (let i = 0; i < keys.length; i += 1) {
                const key = Number(keys[i]);
                if (platform & key) {
                    const idx = data.map[key];
                    if (!isUndefined(idx)) {
                        result[key] = data.shared[idx];
                    }
                }
            }

            return result;
        }

        const idx = data.map[platform];
        if (isUndefined(idx)) {
            return null;
        }

        return { key: data.shared[idx] };
    }

    /**
     * Returns all compatibility data records for the specified platform.
     *
     * @param platform Specific or generic platform.
     *
     * @returns Array of multiple records grouped by platforms.
     */
    public getAllMultiple(platform: SpecificPlatform | GenericPlatform): SinglePlatformRecords<T>[] {
        const result: SinglePlatformRecords<T>[] = [];

        for (let i = 0; i < this.data.shared.length; i += 1) {
            const data = this.data.shared[i];

            const names = new Set(data.shared.map(({ name }) => name));

            names.forEach((name) => {
                const multipleRecords = this.getMultiple(name, platform);
                if (multipleRecords) {
                    result.push(multipleRecords);
                }
            });
        }

        return result;
    }

    /**
     * Returns the first compatibility data record for name and specified platform.
     *
     * @param name Compatibility data name.
     * @param platform Specific or generic platform.
     *
     * @returns First found compatibility data record or `null` if not found.
     */
    public getFirst(name: string, platform: SpecificPlatform | GenericPlatform): T | null {
        const data = this.getRowStorage(name);

        if (!data) {
            return null;
        }

        if (isGenericPlatform(platform)) {
            const keys = Object.keys(data.map);

            for (let i = 0; i < keys.length; i += 1) {
                const key = Number(keys[i]);
                if (platform & key) {
                    const idx = data.map[key];
                    if (!isUndefined(idx)) {
                        // return the first found record
                        return data.shared[idx];
                    }
                }
            }

            return null;
        }

        const idx = data.map[platform];
        if (isUndefined(idx)) {
            return null;
        }

        return data.shared[idx];
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
}
