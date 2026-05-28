/**
 * @file Redirect resource validation bridge.
 *
 * This module provides a redirect resource validator for {@link ModifiersCompatibilityTable}
 * without importing {@link RedirectsCompatibilityTable} from `redirects.ts`.
 * Importing `redirects.ts` directly would create a circular dependency:
 * `modifiers.ts` → `redirects.ts` → `utils/resource-type-helpers.ts` → `modifiers.ts`.
 *
 * The validation logic here intentionally mirrors `RedirectsCompatibilityTable.validate()`.
 * If that method is updated, this module should be updated accordingly.
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
 * Mirrors `redirectNameNormalizer` from `redirects.ts`.
 * Strips the ABP resource prefix and priority suffix from a redirect name.
 *
 * @param name Redirect name to normalize.
 *
 * @returns Normalized redirect name.
 */
const redirectNameNormalizer = (name: string): string => {
    if (name.startsWith(ABP_RESOURCE_PREFIX)) {
        return name.slice(ABP_RESOURCE_PREFIX_LENGTH);
    }

    const colonIndex = name.lastIndexOf(COLON);

    if (colonIndex !== -1 && /^-?\d+$/.test(name.slice(colonIndex + 1))) {
        return name.slice(0, colonIndex);
    }

    return name;
};

/**
 * A minimal redirect resource table that provides only what is needed for modifier validation.
 * Uses the same underlying data as `RedirectsCompatibilityTable`.
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
     * Mirrors `RedirectsCompatibilityTable.validate()`.
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

        const specificRedirectData = this.get(redirectName, platform);

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
