import * as v from 'valibot';

import { strictObjectByType } from '../utils/valibot';

/**
 * Interface that represents query key-value pair with optional {@link replaceOnly} flag.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryKeyValue}
 */
export interface QueryKeyValue {
    /**
     * The name of the query parameter.
     */
    key: string;

    /**
     * If `true`, the query key is replaced only if it's already present.
     * Otherwise, the key is also added if it's missing. Defaults to `false`.
     *
     * @since Chrome 94
     */
    replaceOnly?: boolean;

    /**
     * The value of the query parameter.
     */
    value: string;
}

/**
 * Validator for {@link QueryKeyValue}.
 */
export const QueryKeyValueValidator = strictObjectByType<QueryKeyValue>({
    key: v.string(),
    replaceOnly: v.optional(v.boolean()),
    value: v.string(),
});
