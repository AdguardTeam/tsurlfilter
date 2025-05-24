/**
 * @file Compatibility tables for redirects.
 */

import { CompatibilityTableBase } from './base.js';
import { type RedirectDataSchema } from './schemas/index.js';
import { redirectsCompatibilityTableData } from './compatibility-table-data.js';
import { type CompatibilityTable } from './types.js';
import { deepFreeze } from '../utils/deep-freeze.js';
import { COLON } from '../utils/constants.js';
import { type GenericPlatform, type SpecificPlatform } from './platforms.js';
import { getResourceTypeModifier } from './utils/resource-type-helpers.js';
import { isNull, isString, isUndefined } from '../utils/type-guards.js';

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
     * Gets the resource type adblock modifiers for the redirect for the given platform
     * based on the `resourceTypes` field.
     *
     * @param redirect Redirect name or redirect data.
     * @param platform Platform to get the modifiers for.
     *
     * @returns Set of resource type modifiers or an empty set if the redirect is not found or has no resource types.
     */
    public getResourceTypeModifiers(
        redirect: string | RedirectDataSchema,
        platform: SpecificPlatform | GenericPlatform,
    ): Set<string> {
        let redirectData: RedirectDataSchema | null = null;

        if (isString(redirect)) {
            redirectData = this.getFirst(redirect, platform);
        } else {
            redirectData = redirect;
        }

        const modifierNames = new Set<string>();

        if (isNull(redirectData) || isUndefined(redirectData.resourceTypes)) {
            return modifierNames;
        }

        for (const resourceType of redirectData.resourceTypes) {
            const modifierName = getResourceTypeModifier(resourceType, platform);

            if (isNull(modifierName)) {
                continue;
            }

            modifierNames.add(modifierName);
        }

        return modifierNames;
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
