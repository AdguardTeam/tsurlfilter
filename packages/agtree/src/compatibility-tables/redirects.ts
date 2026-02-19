/**
 * @file Compatibility tables for redirects.
 */

import { sprintf } from 'sprintf-js';

import { CompatibilityTableBase } from './base';
import { type RedirectDataSchema } from './schemas';
import { redirectsCompatibilityTableData } from './compatibility-table-data';
import { type CompatibilityTable } from './types';
import { deepFreeze } from '../utils/deep-freeze';
import { COLON, NEWLINE, SPACE } from '../utils/constants';
import { type AnyPlatform, type SpecificPlatform } from './platforms';
import { getResourceTypeModifier } from './utils/resource-type-helpers';
import { isNull, isString, isUndefined } from '../utils/type-guards';
import { getHumanReadablePlatformName } from './utils/platform-helpers';
import { type ValidationContext } from './validators/types';
import { SOURCE_DATA_ERROR_PREFIX, VALIDATION_ERROR_PREFIX } from '../validator/constants';

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

    /**
     * Remove :[integer] priority suffix from the name, if present.
     *
     * Note: negative values are also supported, see AG-48788.
     *
     * @see https://github.com/AdguardTeam/tsurlfilter/issues/59
     * @see https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#redirect
     */
    const colonIndex = name.lastIndexOf(COLON);

    if (colonIndex !== -1 && /^-?\d+$/.test(name.slice(colonIndex + 1))) {
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
     * @param platform Platform to get the modifiers for (can be specific, generic, or combined platforms).
     *
     * @returns Set of resource type modifiers or an empty set if the redirect is not found or has no resource types.
     */
    public getResourceTypeModifiers(
        redirect: string | RedirectDataSchema,
        platform: AnyPlatform,
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

    /**
     * Validates a redirect against the compatibility table.
     *
     * @param data Redirect name as string.
     * @param ctx Validation context to collect issues into.
     * @param platform Platform to validate against.
     */
    public validate(data: string, ctx: ValidationContext, platform?: SpecificPlatform): void {
        if (platform === undefined) {
            throw new Error('Platform is required for redirect validation');
        }

        const redirectName = isString(data) ? data : '';

        // Get platform-specific data
        const specificRedirectData = this.getSingle(redirectName, platform);

        if (!specificRedirectData) {
            ctx.addError(
                sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(platform)),
            );
            return;
        }

        // Check if removed
        if (specificRedirectData.removed) {
            ctx.addError(`${VALIDATION_ERROR_PREFIX.REMOVED}: '${redirectName}'`);
            return;
        }

        // Check if deprecated
        if (specificRedirectData.deprecated) {
            if (!specificRedirectData.deprecationMessage) {
                throw new Error(`${SOURCE_DATA_ERROR_PREFIX.NO_DEPRECATION_MESSAGE}: '${redirectName}'`);
            }
            const warn = specificRedirectData.deprecationMessage.replace(NEWLINE, SPACE);
            ctx.addWarning(warn);
        }
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
