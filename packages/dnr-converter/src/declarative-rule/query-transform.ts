import * as v from 'valibot';

import { strictObjectByType } from '../utils/valibot';

import { type QueryKeyValue, QueryKeyValueValidator } from './query-key-value';

/**
 * Interface that represents query transformation options.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryTransform}
 */
export interface QueryTransform {
    /**
     * The list of query key-value pairs to be added or replaced.
     *
     * @see {@link QueryKeyValue}
     */
    addOrReplaceParams?: QueryKeyValue[];

    /**
     * The list of query keys to be removed.
     */
    removeParams?: string[];
}

/**
 * Validator for {@link QueryTransform}.
 */
export const QueryTransformValidator = strictObjectByType<QueryTransform>({
    addOrReplaceParams: v.optional(v.array(QueryKeyValueValidator)),
    removeParams: v.optional(v.array(v.string())),
});
