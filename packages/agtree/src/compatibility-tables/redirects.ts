/**
 * @file Compatibility tables for redirects.
 */

import { CompatibilityTableBase } from './base';
import { type RedirectDataSchema } from './schemas';
import { redirectsCompatibilityTableData } from './compatibility-table-data';
import { type CompatibilityTable } from './types';
import { deepFreeze } from '../utils/deep-freeze';
import { COLON } from '../utils/constants';

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
    // See https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#redirect
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
}

/**
 * Deep freeze the compatibility table data to avoid accidental modifications.
 */
deepFreeze(redirectsCompatibilityTableData);

/**
 * Compatibility table instance for redirects.
 */
export const redirectsCompatibilityTable = new RedirectsCompatibilityTable(redirectsCompatibilityTableData);
