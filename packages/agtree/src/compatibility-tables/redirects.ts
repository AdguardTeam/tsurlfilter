/**
 * @file Compatibility tables for redirects.
 */

import { CompatibilityTableBase } from './base';
import { type RedirectDataSchema } from './schemas';
import { redirectsCompatibilityTableData } from './compatibility-table-data';
import { type CompatibilityTable } from './types';
import { deepFreeze } from '../utils/deep-freeze';

/**
 * Prefix for resource redirection names.
 */
const ABP_RESOURCE_PREFIX = 'abp-resource:';
const ABP_RESOURCE_PREFIX_LENGTH = ABP_RESOURCE_PREFIX.length;

/**
 * Transforms the name of an ABP redirect to a normalized form.
 *
 * @param name Redirect name to normalize.
 *
 * @returns Normalized redirect name.
 *
 * @example
 * abpRedirectNameNormalizer('abp-resource:my-resource') // => 'my-resource'
 */
const abpRedirectNameNormalizer = (name: string): string => {
    if (name.startsWith(ABP_RESOURCE_PREFIX)) {
        return name.slice(ABP_RESOURCE_PREFIX_LENGTH);
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
        super(data, abpRedirectNameNormalizer);
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
