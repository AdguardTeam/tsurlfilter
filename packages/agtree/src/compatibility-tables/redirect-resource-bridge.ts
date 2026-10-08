/**
 * @file Redirect resource validation bridge.
 *
 * This module provides the shared redirect validation used by
 * {@link ModifiersCompatibilityTable} and {@link RedirectsCompatibilityTable}.
 * It cannot live in `redirects.ts`: importing `redirects.ts` from `modifiers.ts`
 * would create a circular dependency
 * (`modifiers.ts` → `redirects.ts` → `utils/resource-type-helpers.ts` → `modifiers.ts`).
 *
 * `RedirectsCompatibilityTable.validate()` delegates here, so this is the
 * single implementation of the validation logic.
 */

import { sprintf } from 'sprintf-js';

import { COLON, NEWLINE, SPACE } from '../utils/constants';
import { SOURCE_DATA_ERROR_PREFIX, VALIDATION_ERROR_PREFIX } from '../validator/constants';

import { CompatibilityTableBase } from './base';
import { type Platform } from './platform';
import { redirectsCompatibilityTableData } from './redirects-compatibility-table-data';
import { type RedirectDataSchema } from './schemas';
import { type ValidationContext } from './validators/types';

const ABP_RESOURCE_PREFIX = 'abp-resource:';
const ABP_RESOURCE_PREFIX_LENGTH = ABP_RESOURCE_PREFIX.length;

/**
 * Normalizes the redirect name.
 *
 * Strips the ABP resource prefix and the `:[integer]` priority suffix.
 * Shared by {@link RedirectsCompatibilityTable} and the modifier table's
 * redirect resource validation.
 *
 * @param name Redirect name to normalize.
 *
 * @returns Normalized redirect name.
 *
 * @example
 * redirectNameNormalizer('abp-resource:my-resource') // => 'my-resource'
 * redirectNameNormalizer('noop.js:99') // => 'noop.js'
 */
export const redirectNameNormalizer = (name: string): string => {
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
 * Redirect resource table used for modifier value validation. Uses the same
 * underlying data and name normalization as `RedirectsCompatibilityTable`.
 */
class RedirectResourceTable extends CompatibilityTableBase<RedirectDataSchema> {
    /**
     * Creates a new instance of the redirect resource table.
     */
    constructor() {
        super(redirectsCompatibilityTableData, redirectNameNormalizer);
    }

    /**
     * Validates a redirect resource name against the compatibility table.
     * Also used by `RedirectsCompatibilityTable.validate()`.
     *
     * @param data Redirect name as string.
     * @param ctx Validation context to collect issues into.
     * @param platform Platform to validate against.
     */
    public validate(data: string, ctx: ValidationContext, platform?: Platform): void {
        if (platform === undefined) {
            throw new Error('Platform is required for redirect resource validation');
        }

        const redirectName = typeof data === 'string' ? data : '';

        // Get platform-specific data (product-level wildcards are supported by `query`)
        const specificRedirectData = this.query(redirectName, platform);

        if (!specificRedirectData) {
            ctx.addError(
                sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, platform.toHumanReadable()),
            );
            return;
        }

        if (specificRedirectData.removed) {
            ctx.addError(`${VALIDATION_ERROR_PREFIX.REMOVED}: '${redirectName}'`);
            return;
        }

        if (specificRedirectData.deprecated) {
            if (!specificRedirectData.deprecationMessage) {
                throw new Error(`${SOURCE_DATA_ERROR_PREFIX.NO_DEPRECATION_MESSAGE}: '${redirectName}'`);
            }
            ctx.addWarning(specificRedirectData.deprecationMessage.replace(NEWLINE, SPACE));
        }
    }
}

/**
 * Redirect resource table instance used by {@link ModifiersCompatibilityTable}
 * for validating `$redirect` and `$redirect-rule` values.
 */
export const redirectResourceTable = new RedirectResourceTable();
