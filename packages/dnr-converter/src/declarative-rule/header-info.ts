import * as v from 'valibot';

import { strictObjectByType } from '../utils/valibot';

/**
 * Interface that represents header info to match condition on response headers.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-HeaderInfo}
 *
 * @since Chrome 128
 */
export interface HeaderInfo {
    /**
     * If specified, this condition matches if the header's value
     * matches at least one pattern in this list. This supports
     * case-insensitive header value matching plus the following constructs:
     * - `'*'`: Matches any number of characters.
     * - `'?'`: Matches zero or one character(s).
     * - `'*'` and `'?'` can be escaped with a backslash, e.g. `'\*'` and `'\?'`.
     */
    values?: string[];

    /**
     * If specified, this condition is not matched if the header
     * exists but its value contains at least one element in this list.
     * This uses the same match pattern syntax as {@link values}.
     */
    excludedValues?: string[];

    /**
     * The name of the header. This condition matches on the name only
     * if both {@link values} and {@link excludedValues} are not specified.
     */
    header: string;
}

/**
 * Validator for {@link HeaderInfo}.
 */
export const HeaderInfoValidator = strictObjectByType<HeaderInfo>({
    values: v.optional(v.array(v.string())),
    excludedValues: v.optional(v.array(v.string())),
    header: v.string(),
});
