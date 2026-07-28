import * as v from 'valibot';

import { strictObjectByType } from '../utils/valibot';

/**
 * Enum that represents the possible operations for a header modification.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-HeaderOperation}
 *
 * @since Chrome 86
 */
export enum HeaderOperation {
    /**
     * Adds a new entry for the specified header.
     * This operation is not supported for request headers.
     */
    Append = 'append',

    /**
     * Sets a new value for the specified header, removing any existing headers with the same name.
     */
    Set = 'set',

    /**
     * Removes all entries for the specified header.
     */
    Remove = 'remove',
}

/**
 * Interface that represents header info modification operation.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ModifyHeaderInfo}
 *
 * @since Chrome 86
 */
export interface ModifyHeaderInfo {
    /**
     * The name of the header to be modified.
     */
    header: string;

    /**
     * The operation to be performed on a header.
     */
    operation: HeaderOperation;

    /**
     * The new value for the header. Must be specified for `append` and `set` operations.
     */
    value?: string;
}

/**
 * Validator for {@link ModifyHeaderInfo}.
 */
export const ModifyHeaderInfoValidator = strictObjectByType<ModifyHeaderInfo>({
    header: v.string(),
    operation: v.enum(HeaderOperation),
    value: v.optional(v.string()),
});
