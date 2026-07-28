/**
 * @file
 * Self-contained function that patches `history.pushState` and
 * `history.replaceState` in the **main world** to support `$removeparam`
 * rules applied via the History API.
 *
 * Descriptors are passed directly as a function argument from the background
 * (MV3 via `chrome.scripting.executeScript({ args })`, MV2 via JSON embed
 * in the serialized function body).
 *
 * This function has **no module imports** so that it can be serialized via
 * `.toString()` for inline `<script>` injection in MV2.
 */

import { type RemoveParamDescriptor } from '../utils/remove-param-rules';

/**
 * Patches `history.pushState` and `history.replaceState` so that every
 * History API navigation has `$removeparam` rules applied locally using
 * pre-loaded rule descriptors.
 *
 * The patched methods work as follows:
 * 1. Call the original method immediately (SPA behaviour is preserved).
 * 2. If the URL contains query parameters, apply parameter removal synchronously.
 * 3. If the URL changed, call `replaceState` to update the address bar.
 *
 * **Important**: every constant and helper referenced inside the function
 * body is declared as a local variable so that
 * `Function.prototype.toString()` produces a self-contained IIFE for MV2
 * injection.
 *
 * @param rawDescriptors Array of serialized rule descriptors to apply.
 * Passed directly from the background (MV3 via `args`, MV2 via JSON embed).
 * @param nonce Random token used as the window property name for the
 * updater function, making it unguessable by page scripts.
 * @param secret Secret token that must be passed to the updater on every
 * call.  Prevents page scripts that discover the property name from
 * tampering with the descriptor list.
 */
export function patchHistoryForRemoveParam(
    rawDescriptors: RemoveParamDescriptor[],
    nonce: string,
    secret: string,
): void {
    /**
     * Parsed descriptor used internally.
     */
    interface Descriptor {
        valueRegExp: RegExp | null;
        isAllowlist: boolean;
        isNegated: boolean;
    }

    /**
     * Escapes characters with special meaning inside a regular expression.
     *
     * @param str The string to escape.
     *
     * @returns The escaped string.
     */
    function escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Parses a modifier value string into a RegExp, following the same logic
     * as `RemoveParamModifier` in `@adguard/tsurlfilter`.
     *
     * @param value The modifier value.
     *
     * @returns Object with the compiled regex (or null for bare removeparam)
     * and whether the match is negated.
     */
    function parseValue(value: string): { regex: RegExp | null; isNegated: boolean } {
        if (!value) {
            return { regex: null, isNegated: false };
        }

        let rawValue = value;
        let isNegated = false;

        if (value.startsWith('~')) {
            rawValue = value.substring(1);
            isNegated = true;
        }

        if (rawValue.startsWith('/')) {
            // Regex literal: /pattern/flags
            const lastSlash = rawValue.lastIndexOf('/');
            if (lastSlash > 0) {
                const pattern = rawValue.substring(1, lastSlash);
                const flags = rawValue.substring(lastSlash + 1);
                return { regex: new RegExp(pattern, flags), isNegated };
            }
            // Fallback: treat as literal
            return {
                regex: new RegExp(`^${escapeRegex(rawValue)}=[^&#]*$`),
                isNegated,
            };
        }

        return {
            regex: new RegExp(`^${escapeRegex(rawValue)}=[^&#]*$`),
            isNegated,
        };
    }

    let descriptors: Descriptor[] | null = rawDescriptors.map((d: RemoveParamDescriptor) => {
        const { regex, isNegated } = parseValue(d.value);
        return {
            valueRegExp: regex,
            isAllowlist: d.isAllowlist,
            isNegated,
        };
    });

    const proto = History.prototype;
    const pushStateDesc = Object.getOwnPropertyDescriptor(proto, 'pushState');
    const replaceStateDesc = Object.getOwnPropertyDescriptor(proto, 'replaceState');

    if (!pushStateDesc?.value || !replaceStateDesc?.value) {
        return;
    }

    const originalPushState: typeof window.history.pushState = pushStateDesc.value;
    const originalReplaceState: typeof window.history.replaceState = replaceStateDesc.value;

    /**
     * Removes query parameters from a URL using a regex.
     *
     * @param url The URL to process.
     * @param regExp The regex to match parameters against.
     * @param invert If true, keep only matching parameters.
     *
     * @returns The URL with parameters removed.
     */
    function cleanUrlParams(url: string, regExp: RegExp, invert: boolean): string {
        const qIndex = url.indexOf('?');
        if (qIndex === -1) {
            return url;
        }

        let hashPart = '';
        const hashIndex = url.indexOf('#');
        let urlWithoutHash = url;
        if (hashIndex >= 0) {
            hashPart = url.slice(hashIndex);
            urlWithoutHash = url.slice(0, hashIndex);
        }

        const pathPart = urlWithoutHash.slice(0, qIndex);
        const queryPart = urlWithoutHash.slice(qIndex + 1);

        let modifiedQuery: string;
        if (invert) {
            modifiedQuery = queryPart
                .split('&')
                .filter((x) => {
                    if (!x) {
                        return false;
                    }
                    const match = regExp.test(x);
                    if (match) {
                        return true;
                    }
                    try {
                        const decoded = decodeURIComponent(x);
                        return regExp.test(decoded);
                    } catch {
                        return false;
                    }
                })
                .join('&');
        } else {
            modifiedQuery = queryPart
                .split('&')
                .filter((x) => {
                    const test = x.includes('=') ? x : `${x}=`;
                    if (regExp.test(test)) {
                        return false;
                    }
                    try {
                        const decoded = decodeURIComponent(test);
                        return !regExp.test(decoded);
                    } catch {
                        return true;
                    }
                })
                .join('&');
        }

        if (modifiedQuery === queryPart) {
            return url;
        }

        // Normalize: remove leading '&' and empty '=' entries
        modifiedQuery = modifiedQuery
            .split('&')
            .filter((x) => x && !x.startsWith('='))
            .join('&');
        while (modifiedQuery.charAt(0) === '&') {
            modifiedQuery = modifiedQuery.slice(1);
        }

        let result = pathPart;
        if (modifiedQuery) {
            result += `?${modifiedQuery}`;
        }
        return result + hashPart;
    }

    /**
     * Applies all loaded descriptors to a URL, returning the cleaned URL
     * and the list of descriptors that actually modified it.
     *
     * @param url The URL to process.
     *
     * @returns Object with cleaned URL and applied descriptors, or null if
     * no changes were made.
     */
    function applyDescriptors(
        url: string,
    ): { cleanedUrl: string; applied: Descriptor[] } | null {
        if (!descriptors || descriptors.length === 0) {
            return null;
        }

        let purgedUrl = url;
        const applied: Descriptor[] = [];

        for (const desc of descriptors) {
            if (desc.isAllowlist) {
                // Allowlist rules are handled by MatchingResult in the
                // background — if an allowlist rule is present, the
                // corresponding blocking rule should have been filtered out.
                continue;
            }

            if (desc.valueRegExp === null) {
                // Bare removeparam: remove all query parameters, preserve hash
                const queryIndex = purgedUrl.indexOf('?');
                if (queryIndex >= 0) {
                    let hashSuffix = '';

                    const hashIdx = purgedUrl.indexOf('#');
                    if (hashIdx >= 0) {
                        hashSuffix = purgedUrl.substring(hashIdx);
                    }

                    const newUrl = purgedUrl.substring(0, queryIndex) + hashSuffix;
                    if (newUrl !== purgedUrl) {
                        applied.push(desc);
                        purgedUrl = newUrl;
                    }
                }
                continue;
            }

            const modifiedUrl = cleanUrlParams(purgedUrl, desc.valueRegExp, desc.isNegated);
            if (modifiedUrl !== purgedUrl) {
                applied.push(desc);
                purgedUrl = modifiedUrl;
            }
        }

        if (purgedUrl === url) {
            return null;
        }

        return { cleanedUrl: purgedUrl, applied };
    }

    /**
     * Processes a URL: applies parameter removal and updates the address bar.
     *
     * @param state History state.
     * @param title Page title.
     * @param absoluteUrl Absolute URL to process.
     */
    function processUrl(state: unknown, title: string, absoluteUrl: string): void {
        const result = applyDescriptors(absoluteUrl);
        if (!result) {
            return;
        }

        if (result.cleanedUrl !== absoluteUrl && window.location.href === absoluteUrl) {
            originalReplaceState.call(window.history, state, title, result.cleanedUrl);
        }
    }

    /**
     * Creates a patched version of a History API method that preserves the
     * native method's observable properties (name, length, toString) to
     * reduce detectability.
     *
     * @param originalMethod The original `pushState` or `replaceState`.
     * @param methodName The name of the method being patched.
     *
     * @returns A replacement function with the same signature.
     */
    function createPatchedMethod(
        originalMethod: typeof window.history.pushState,
        methodName: string,
    ): typeof window.history.pushState {
        const patched = function patchedHistoryMethod(
            this: History,
            state: unknown,
            title: string,
            url?: string | URL | null,
        ): void {
            // Always call the original method first to preserve SPA behaviour.
            originalMethod.call(this, state, title, url);

            if (!url) {
                return;
            }

            const absoluteUrl = new URL(url.toString(), document.baseURI).href;

            // Skip non-HTTP URLs and URLs without query parameters.
            if (!absoluteUrl.startsWith('http') || !absoluteUrl.includes('?')) {
                return;
            }

            processUrl(state, title, absoluteUrl);
        };

        // Match the native method's observable properties.
        Object.defineProperty(patched, 'name', { value: methodName, configurable: true });
        Object.defineProperty(patched, 'length', {
            value: originalMethod.length,
            configurable: true,
        });

        return patched;
    }

    // Patch immediately so we capture all navigations
    Object.defineProperty(proto, 'pushState', {
        ...pushStateDesc,
        value: createPatchedMethod(originalPushState, 'pushState'),
    });

    Object.defineProperty(proto, 'replaceState', {
        ...replaceStateDesc,
        value: createPatchedMethod(originalReplaceState, 'replaceState'),
    });

    processUrl(window.history.state, document.title, window.location.href);

    // Expose a non-enumerable updater function on `window` keyed by the
    // injection nonce.  The background calls this directly via
    // `chrome.scripting.executeScript({ world: 'MAIN' })` (MV3) or
    // `<script>` element injection (MV2), so no broadcasting through
    // `window.postMessage` or extension messaging is needed.
    Object.defineProperty(window, nonce, {
        value: (token: string, rawDescs: RemoveParamDescriptor[]) => {
            if (token !== secret) {
                return;
            }

            if (!rawDescs || rawDescs.length === 0) {
                descriptors = null;
                return;
            }

            descriptors = rawDescs.map((d: RemoveParamDescriptor) => {
                const { regex, isNegated } = parseValue(d.value);
                return {
                    valueRegExp: regex,
                    isAllowlist: d.isAllowlist,
                    isNegated,
                };
            });

            // Apply newly loaded descriptors to the current URL immediately.
            // This handles the case where the page navigated (via pushState)
            // before descriptors were available — the SPA navigation that
            // triggered onHistoryStateUpdated may have already placed
            // tracking params in the address bar.
            const currentUrl = window.location.href;
            if (currentUrl.startsWith('http') && currentUrl.includes('?')) {
                processUrl(window.history.state, '', currentUrl);
            }
        },
        configurable: false,
        enumerable: false,
        writable: false,
    });
}
