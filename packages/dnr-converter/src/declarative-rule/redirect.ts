import * as v from 'valibot';

import { strictObjectByType } from '../utils/valibot';

import { type URLTransform, URLTransformValidator } from './url-transform';

/**
 * Interface that represents a redirect action.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Redirect}
 */
export interface Redirect {
    /**
     * Path relative to the extension directory. Should start with `'/'`.
     */
    extensionPath?: string;

    /**
     * Substitution pattern for rules which specify a `regexFilter`.
     * The first match of `regexFilter` within the URL will be replaced with this pattern.
     * Within {@link regexSubstitution}, backslash-escaped digits (\1 to \9) can be used
     * to insert the corresponding capture groups. \0 refers to the entire matching text.
     */
    regexSubstitution?: string;

    /**
     * URL transformations to perform.
     *
     * @see {@link URLTransform}
     */
    transform?: URLTransform;

    /**
     * The redirect URL. Redirects to JavaScript URLs are not allowed.
     */
    url?: string;
}

/**
 * Validator for {@link Redirect}.
 */
export const RedirectValidator = strictObjectByType<Redirect>({
    extensionPath: v.optional(v.string()),
    regexSubstitution: v.optional(v.string()),
    transform: v.optional(URLTransformValidator),
    url: v.optional(v.string()),
});
