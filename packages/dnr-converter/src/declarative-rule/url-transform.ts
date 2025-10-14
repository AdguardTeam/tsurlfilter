import * as v from 'valibot';

import { strictObjectByType } from '../utils/valibot';

import { type QueryTransform, QueryTransformValidator } from './query-transform';

/**
 * Enum that represents URL transformation schemes.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-URLTransform}
 */
export enum URLTransformScheme {
    Http = 'http',
    Https = 'https',
    Ftp = 'ftp',
    ChromeExtension = 'chrome-extension',
}

/**
 * Interface that represents URL transformations.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-URLTransform}
 */
export interface URLTransform {
    /**
     * The new fragment for the request.
     *
     * Should be either empty `''`, in which case the existing
     * fragment is cleared, or should begin with `'#'`.
     */
    fragment?: string;

    /**
     * The new host for the request.
     */
    host?: string;

    /**
     * The new password for the request.
     */
    password?: string;

    /**
     * The new path for the request. If empty, the existing path is cleared.
     */
    path?: string;

    /**
     * The new port for the request. If empty, the existing port is cleared.
     */
    port?: string;

    /**
     * The new query for the request.
     *
     * Should be either empty `''`, in which case the existing
     * query is cleared, or should begin with `'?'`.
     */
    query?: string;

    /**
     * Add, remove or replace query key-value pairs.
     *
     * @see {@link QueryTransform}
     */
    queryTransform?: QueryTransform;

    /**
     * The new scheme for the request.
     *
     * @see {@link URLTransformScheme}
     */
    scheme?: URLTransformScheme;

    /**
     * The new username for the request.
     */
    username?: string;
}

/**
 * Validator for {@link URLTransform}.
 */
export const URLTransformValidator = strictObjectByType<URLTransform>({
    fragment: v.optional(v.string()),
    host: v.optional(v.string()),
    password: v.optional(v.string()),
    path: v.optional(v.string()),
    port: v.optional(v.string()),
    query: v.optional(v.string()),
    queryTransform: v.optional(QueryTransformValidator),
    scheme: v.optional(v.enum(URLTransformScheme)),
    username: v.optional(v.string()),
});
