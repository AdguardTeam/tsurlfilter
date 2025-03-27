/* eslint-disable no-bitwise */
/**
 * @file Provides common compatibility table methods.
 */

import { type BaseCompatibilityDataSchema } from './schemas';
import { GenericPlatform, type SpecificPlatform } from './platforms';
import { isUndefined } from '../utils/type-guards';
import { type CompatibilityTable, type CompatibilityTableRow } from './types';
import { isGenericPlatform, getSpecificPlatformName } from './utils/platform-helpers';
import { AdblockSyntax } from '../utils/adblockers';

/**
 * Lists all supported entity records by a product.
 *
 * Keys are compatibility flags, values are compatibility data records.
 *
 * @template T Compatibility data schema.
 */
export type ProductRecords<T> = {
    [key: string]: T;
};

/**
 * Defines a compatibility table row by product.
 *
 * Keys are Adblock syntaxes, values are product records.
 *
 * @template T Compatibility data schema.
 */
export type RowByProduct<T> = {
    [AdblockSyntax.Adg]: ProductRecords<T>;
    [AdblockSyntax.Ubo]: ProductRecords<T>;
    [AdblockSyntax.Abp]: ProductRecords<T>;
};

/**
 * Defines multiple compatibility table rows by product.
 *
 * @template T Compatibility data schema.
 */
export type RowsByProduct<T> = RowByProduct<T>[];

/**
 * Single platform records type.
 *
 * Keys are platform enums values, values are compatibility data records.
 *
 * @template T Compatibility data schema.
 */
type SinglePlatformRecords<T> = {
    [key: string]: T;
};

/**
 * Name transformer function type. This function is used to normalize compatibility data names before processing them,
 * e.g. converting to lowercase, remove unnecessary prefixes, etc.
 *
 * @param name Compatibility data name.
 *
 * @returns Normalized name.
 */
type NameTransformer = (name: string) => string;

/**
 * Base compatibility table class which provides common methods to work with compatibility data.
 *
 * @template T Compatibility data schema.
 */
export abstract class CompatibilityTableBase<T extends BaseCompatibilityDataSchema> {
    /**
     * Compatibility table data.
     */
    private data: CompatibilityTable<T>;

    /**
     * Optional name transformer function. If provided,
     * it will be called in all methods before processing compatibility data names.
     */
    private readonly nameTransformer: NameTransformer | null;

    /**
     * Creates a new instance of the common compatibility table.
     *
     * @param data Compatibility table data.
     * @param nameTransformer Optional name transformer function.
     */
    constructor(data: CompatibilityTable<T>, nameTransformer: NameTransformer | null = null) {
        this.data = data;
        this.nameTransformer = nameTransformer;
    }

    /**
     * Helper method to get a 'row' from the compatibility table data by name.
     *
     * @param name Compatibility data name.
     * @returns Compatibility table row storage or `null` if not found.
     */
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
        const normalizedName = this.nameTransformer ? this.nameTransformer(name) : name;
        return !isUndefined(this.data.map[normalizedName]);
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
        const normalizedName = this.nameTransformer ? this.nameTransformer(name) : name;
        const data = this.getRowStorage(normalizedName);

        if (!data) {
            return false;
        }

        const isMatch = (idx: number): boolean => {
            const el = data.shared[idx];
            return !isUndefined(el) && (el.name === normalizedName || !!el.aliases?.includes(normalizedName));
        };

        if (isGenericPlatform(platform)) {
            // Since indexes are specific platforms in the compatibility table data,
            // we can't index them directly if the platform is generic (union of specific platforms).
            // In this case, we need to iterate over the keys and return true on the first match.
            const keys = Object.keys(data.map);
            for (let i = 0; i < keys.length; i += 1) {
                const key = Number(keys[i]);
                if (platform & key) {
                    const idx = data.map[key];
                    if (isMatch(idx)) {
                        return true;
                    }
                }
            }

            return false;
        }

        const idx = data.map[platform];
        return isMatch(idx);
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
        const normalizedName = this.nameTransformer ? this.nameTransformer(name) : name;
        const data = this.getRowStorage(normalizedName);

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
    public getMultiple(
        name: string,
        platform: SpecificPlatform | GenericPlatform,
    ): SinglePlatformRecords<T> | null {
        const normalizedName = this.nameTransformer ? this.nameTransformer(name) : name;
        const data = this.getRowStorage(normalizedName);

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
        const normalizedName = this.nameTransformer ? this.nameTransformer(name) : name;
        const data = this.getRowStorage(normalizedName);

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

    /**
     * Returns all compatibility data records for the specified name.
     *
     * @param name Compatibility data name.
     *
     * @returns Array of multiple records grouped by platforms.
     */
    public getRow(name: string): T[] {
        const normalizedName = this.nameTransformer ? this.nameTransformer(name) : name;
        const data = this.getRowStorage(normalizedName);

        if (!data) {
            return [];
        }

        return data.shared;
    }

    /**
     * Returns all compatibility data grouped by products.
     *
     * @returns Array of multiple records grouped by products.
     */
    public getRowsByProduct(): RowsByProduct<T> {
        const result: RowsByProduct<T> = [];

        for (let i = 0; i < this.data.shared.length; i += 1) {
            const data = this.data.shared[i];
            const keys = Object.keys(data.map);

            const row: RowByProduct<T> = {
                [AdblockSyntax.Adg]: {},
                [AdblockSyntax.Ubo]: {},
                [AdblockSyntax.Abp]: {},
            };

            for (let j = 0; j < keys.length; j += 1) {
                const key = Number(keys[j]);
                if (key & GenericPlatform.AdgAny) {
                    row[AdblockSyntax.Adg][key] = data.shared[data.map[key]];
                } else if (key & GenericPlatform.UboAny) {
                    row[AdblockSyntax.Ubo][key] = data.shared[data.map[key]];
                } else if (key & GenericPlatform.AbpAny) {
                    row[AdblockSyntax.Abp][key] = data.shared[data.map[key]];
                }
            }

            result.push(row);
        }

        return result;
    }
}
