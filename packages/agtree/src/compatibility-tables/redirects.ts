/**
 * @file Compatibility tables for redirects.
 */

import { CompatibilityTableBase } from './base';
import { type RedirectDataSchema } from './schemas';
import { redirectsCompatibilityTableData } from './compatibility-table-data';
import { type CompatibilityTable } from './types';
import { deepFreeze } from '../utils/deep-freeze';
import { COLON } from '../utils/constants';
import { type GenericPlatform, type SpecificPlatform } from './platforms';
import { RESOURCE_TYPE_MODIFIER_MAP } from './utils/resource-types-helpers';
import { modifiersCompatibilityTable } from './modifiers';

/**
 * Prefix for resource redirection names.
 */
const ABP_RESOURCE_PREFIX = 'abp-resource:';
const ABP_RESOURCE_PREFIX_LENGTH = ABP_RESOURCE_PREFIX.length;

/**
 * Normalizes the redirect name.
 *
 * @param name Redirect name to normalize.
 *
 * @returns Normalized redirect name.
 *
 * @example
 * redirectNameNormalizer('abp-resource:my-resource') // => 'my-resource'
 * redirectNameNormalizer('noop.js:99') // => 'noop.js'
 */
const redirectNameNormalizer = (name: string): string => {
    // Remove ABP resource prefix, if present
    if (name.startsWith(ABP_RESOURCE_PREFIX)) {
        return name.slice(ABP_RESOURCE_PREFIX_LENGTH);
    }

    // Remove :[integer] priority suffix from the name, if present
    // See:
    // - https://github.com/AdguardTeam/tsurlfilter/issues/59
    // - https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#redirect
    const colonIndex = name.lastIndexOf(COLON);

    if (colonIndex !== -1 && /^\d+$/.test(name.slice(colonIndex + 1))) {
        return name.slice(0, colonIndex);
    }

    return name;
};

/**
 * Compatibility table for redirects.
 */
class RedirectsCompatibilityTable extends CompatibilityTableBase<RedirectDataSchema> {
    /**
     * Creates a new instance of the compatibility table for redirects.
     *
     * @param data Compatibility table data.
     */
    constructor(data: CompatibilityTable<RedirectDataSchema>) {
        super(data, redirectNameNormalizer);
    }

    /**
     * Gets the resource type modifiers for the redirect based on the `resourceTypes` field.
     *
     * @param data Redirect data.
     * @param platform Platform to get the modifiers for.
     * @returns Set of resource type modifiers.
     */
    // eslint-disable-next-line class-methods-use-this
    public getResourceTypeModifiersByData(
        data: RedirectDataSchema,
        platform: SpecificPlatform | GenericPlatform,
    ): Set<string> {
        const modifierNames = new Set<string>();

        if (!data.resourceTypes) {
            return modifierNames;
        }

        for (const resourceType of data.resourceTypes) {
            const modifierName = RESOURCE_TYPE_MODIFIER_MAP.get(resourceType);

            if (!modifierName) {
                continue;
            }

            const modifierData = modifiersCompatibilityTable.getFirst(modifierName, platform);

            if (modifierData) {
                modifierNames.add(modifierData.name);
            }
        }

        return modifierNames;
    }

    /**
     * Gets the resource type modifiers for the redirect based on the `resourceTypes` field.
     *
     * @param name Redirect name.
     * @param platform Platform to get the modifiers for.
     * @returns Set of resource type modifiers or an empty set if the redirect is not found.
     */
    public getResourceTypeModifiers(name: string, platform: SpecificPlatform | GenericPlatform): Set<string> {
        const resourceData = this.getFirst(name, platform);

        if (!resourceData) {
            return new Set();
        }

        return this.getResourceTypeModifiersByData(resourceData, platform);
    }
}

/**
 * Deep freeze the compatibility table data to avoid accidental modifications.
 */
deepFreeze(redirectsCompatibilityTableData);

/**
 * Compatibility table instance for redirects.
 */
export const redirectsCompatibilityTable = new RedirectsCompatibilityTable(redirectsCompatibilityTableData);
