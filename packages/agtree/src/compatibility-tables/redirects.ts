/**
 * @file Compatibility tables for redirects.
 */

import { isNull, isString, isUndefined } from '../utils/type-guards';

import { CompatibilityTableBase } from './base';
import { type Platform } from './platform';
import { redirectNameNormalizer, redirectResourceTable } from './redirect-resource-bridge';
import { redirectsCompatibilityTableData } from './redirects-compatibility-table-data';
import { type RedirectDataSchema } from './schemas';
import { type CompatibilityTable } from './types';
import { getResourceTypeModifier } from './utils/resource-type-helpers';
import { type ValidationContext } from './validators/types';

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
        platform: Platform,
    ): Set<string> {
        let redirectData: RedirectDataSchema | null = null;

        if (isString(redirect)) {
            redirectData = this.query(redirect, platform);
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
     * Delegates to the shared redirect resource bridge — the same
     * implementation used by the modifier table. Keeping the logic there
     * avoids the `modifiers.ts` → `redirects.ts` import cycle.
     *
     * @param data Redirect name as string.
     * @param ctx Validation context to collect issues into.
     * @param platform Platform to validate against.
     */
    // eslint-disable-next-line class-methods-use-this
    public validate(data: string, ctx: ValidationContext, platform?: Platform): void {
        if (platform === undefined) {
            throw new Error('Platform is required for redirect validation');
        }

        redirectResourceTable.validate(data, ctx, platform);
    }
}

/**
 * Compatibility table instance for redirects.
 */
export const redirectsCompatibilityTable = new RedirectsCompatibilityTable(redirectsCompatibilityTableData);
