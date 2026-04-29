/**
 * @file
 * Self-contained function that patches `history.pushState` and
 * `history.replaceState` in the **main world** to support `$removeparam`
 * rules applied via the History API.
 *
 * Rules are received once from the isolated-world content script via
 * `window.postMessage`. Parameter removal is applied locally without
 * messaging the background for each navigation.
 *
 * This function has **no module imports** so that it can be serialized via
 * `.toString()` for inline `<script>` injection in MV2.
 */

/**
 * `postMessage` type for $removeparam config (isolated world → main world).
 */
export const REMOVEPARAM_CONFIG_TYPE = '__adg_removeparam_config';

/**
 * `postMessage` type for $removeparam log events (main world → isolated world).
 */
export const REMOVEPARAM_LOG_TYPE = '__adg_removeparam_log';

/**
 * Descriptor data shape used inside the main-world function.
 * Mirrors the serialized `RemoveParamDescriptor` from the background.
 */
export interface RemoveParamDescriptorData {
    value: string;
    isAllowlist: boolean;
    isImportant: boolean;
    filterId: number;
    ruleIndex: number;
    ruleText: string;
    advancedModifier: string | null;
}

/**
 * Patches `history.pushState` and `history.replaceState` so that every
 * History API navigation has `$removeparam` rules applied locally using
 * pre-loaded rule descriptors.
 *
 * The patched methods work as follows:
 * 1. Call the original method immediately (SPA behaviour is preserved).
 * 2. If rules are loaded and the URL contains query parameters, apply
 *    parameter removal synchronously.
 * 3. If the URL changed, call `replaceState` to update the address bar
 *    and post a log event to the isolated world.
 * 4. If rules have not yet arrived, buffer the URL for later processing.
 *
 * **Important**: every constant and helper referenced inside the function
 * body is declared as a local variable so that
 * `Function.prototype.toString()` produces a self-contained IIFE for MV2
 * injection.
 */
export function patchHistoryForRemoveParam(): void {
    // Constants are duplicated here (not imported) for serialization safety.
    const CONFIG_TYPE = '__adg_removeparam_config';
    const LOG_TYPE = '__adg_removeparam_log';

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    /**
     * Parsed descriptor used internally.
     */
    interface Descriptor {
        valueRegExp: RegExp | null;
        value: string;
        isAllowlist: boolean;
        isImportant: boolean;
        isNegated: boolean;
        filterId: number;
        ruleIndex: number;
        ruleText: string;
        advancedModifier: string | null;
    }

    let descriptors: Descriptor[] | null = null;
    let buffer: { state: unknown; title: string; url: string }[] = [];

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
                let flags = rawValue.substring(lastSlash + 1);
                if (!flags.includes('g')) {
                    flags += 'g';
                }
                return { regex: new RegExp(pattern, flags), isNegated };
            }
            // Fallback: treat as literal
            return {
                regex: new RegExp(`^${escapeRegex(rawValue)}=[^&#]*$`, 'g'),
                isNegated,
            };
        }

        return {
            regex: new RegExp(`^${escapeRegex(rawValue)}=[^&#]*$`, 'g'),
            isNegated,
        };
    }

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
                    // Reset regex lastIndex for global flag
                    regExp.lastIndex = 0;
                    const match = regExp.test(x);
                    regExp.lastIndex = 0;
                    if (match) {
                        return true;
                    }
                    try {
                        const decoded = decodeURIComponent(x);
                        regExp.lastIndex = 0;
                        const decodedMatch = regExp.test(decoded);
                        regExp.lastIndex = 0;
                        return decodedMatch;
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
                    regExp.lastIndex = 0;
                    const match = regExp.test(test);
                    regExp.lastIndex = 0;
                    if (match) {
                        return false;
                    }
                    try {
                        const decoded = decodeURIComponent(test);
                        regExp.lastIndex = 0;
                        const decodedMatch = regExp.test(decoded);
                        regExp.lastIndex = 0;
                        return !decodedMatch;
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
                // We include them here for log reporting only.
                continue;
            }

            if (desc.valueRegExp === null) {
                // Bare removeparam: remove all query parameters, preserve hash
                const sepIndex = purgedUrl.indexOf('?');
                if (sepIndex >= 0) {
                    let hashSuffix = '';
                    const hashIdx = purgedUrl.indexOf('#');
                    if (hashIdx >= 0) {
                        hashSuffix = purgedUrl.substring(hashIdx);
                    }
                    const newUrl = purgedUrl.substring(0, sepIndex) + hashSuffix;
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
     * Processes a URL: applies parameter removal and posts log event.
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
            originalReplaceState(state, title, result.cleanedUrl);
        }

        // Post log event to isolated world (fire-and-forget)
        window.postMessage({
            type: LOG_TYPE,
            cleanedUrl: result.cleanedUrl,
            originalUrl: absoluteUrl,
            appliedDescriptors: result.applied.map((d) => ({
                filterId: d.filterId,
                ruleIndex: d.ruleIndex,
                ruleText: d.ruleText,
                isAllowlist: d.isAllowlist,
                isImportant: d.isImportant,
                advancedModifier: d.advancedModifier,
            })),
        }, '*');
    }

    /**
     * Creates a patched version of a History API method.
     *
     * @param originalMethod The original `pushState` or `replaceState`.
     *
     * @returns A replacement function with the same signature.
     */
    function createPatchedMethod(
        originalMethod: typeof window.history.pushState,
    ): typeof window.history.pushState {
        return function patchedHistoryMethod(
            state: unknown,
            title: string,
            url?: string | URL | null,
        ): void {
            // Always call the original method first to preserve SPA behaviour.
            originalMethod(state, title, url);

            if (!url) {
                return;
            }

            const absoluteUrl = new URL(url.toString(), document.baseURI).href;

            // Skip non-HTTP URLs and URLs without query parameters.
            if (!absoluteUrl.startsWith('http') || !absoluteUrl.includes('?')) {
                return;
            }

            if (descriptors === null) {
                // Rules haven't arrived yet — buffer for later
                buffer.push({ state, title, url: absoluteUrl });
                return;
            }

            processUrl(state, title, absoluteUrl);
        };
    }

    // Patch immediately so we capture all navigations
    window.history.pushState = createPatchedMethod(originalPushState);
    window.history.replaceState = createPatchedMethod(originalReplaceState);

    // Listen for config from isolated world (one-time)
    /**
     * Handler for the config message from the isolated-world content script.
     *
     * @param event MessageEvent from the isolated world.
     */
    const configHandler = (event: MessageEvent): void => {
        if (event.data?.type !== CONFIG_TYPE) {
            return;
        }

        window.removeEventListener('message', configHandler);

        const rawDescriptors = event.data.descriptors;

        if (!Array.isArray(rawDescriptors) || rawDescriptors.length === 0) {
            // No rules for this site — restore original methods
            window.history.pushState = originalPushState;
            window.history.replaceState = originalReplaceState;
            buffer = [];
            descriptors = [];
            return;
        }

        // Parse descriptors
        descriptors = rawDescriptors.map((d: RemoveParamDescriptorData) => {
            const { regex, isNegated } = parseValue(d.value);
            return {
                valueRegExp: regex,
                value: d.value,
                isAllowlist: d.isAllowlist,
                isImportant: d.isImportant,
                isNegated,
                filterId: d.filterId,
                ruleIndex: d.ruleIndex,
                ruleText: d.ruleText,
                advancedModifier: d.advancedModifier,
            };
        });

        // Process buffered URLs
        for (const item of buffer) {
            processUrl(item.state, item.title, item.url);
        }
        buffer = [];
    };

    window.addEventListener('message', configHandler);
}
