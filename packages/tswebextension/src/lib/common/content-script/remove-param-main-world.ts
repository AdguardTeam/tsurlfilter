/**
 * @file
 * Self-contained function that patches `history.pushState` and
 * `history.replaceState` in the **main world** to support `$removeparam`
 * rules applied via the History API.
 *
 * Communication with the isolated-world bridge (see
 * {@link RemoveParamHandler}) uses `window.postMessage`.
 *
 * This function has **no module imports** so that it can be serialized via
 * `.toString()` for inline `<script>` injection in MV2.
 */

/**
 * `postMessage` type for $removeparam requests (main world → isolated world).
 */
export const REMOVEPARAM_REQUEST_TYPE = '__adg_removeparam_request';

/**
 * `postMessage` type for $removeparam responses (isolated world → main world).
 */
export const REMOVEPARAM_RESPONSE_TYPE = '__adg_removeparam_response';

/**
 * Patches `history.pushState` and `history.replaceState` so that every
 * History API navigation is checked against `$removeparam` rules via the
 * background script.
 *
 * The patched methods work as follows:
 * 1. Call the original method immediately (SPA behaviour is preserved).
 * 2. If the URL contains query parameters, post a message to the
 *    isolated-world bridge.
 * 3. When the bridge responds with a cleaned URL, call the original
 *    `replaceState` to update the address bar.
 *
 * **Important**: every constant referenced inside the function body is
 * declared as a local variable so that `Function.prototype.toString()`
 * produces a self-contained IIFE for MV2 injection.
 */
export function patchHistoryForRemoveParam(): void {
    // Constants are duplicated here (not imported) for serialization safety.
    const REQUEST = '__adg_removeparam_request';
    const RESPONSE = '__adg_removeparam_response';

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    let requestCounter = 0;

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

            requestCounter += 1;
            const requestId = requestCounter;

            /**
             * One-shot listener that waits for the bridge response matching
             * this `requestId`.
             *
             * @param event MessageEvent from the isolated world.
             */
            const handler = (event: MessageEvent): void => {
                const { data } = event;
                if (
                    data?.type === RESPONSE
                    && data.requestId === requestId
                ) {
                    window.removeEventListener('message', handler);

                    if (
                        data.cleanedUrl
                        && data.cleanedUrl !== absoluteUrl
                        && window.location.href === absoluteUrl
                    ) {
                        originalReplaceState(state, title, data.cleanedUrl);
                    }
                }
            };

            window.addEventListener('message', handler);
            window.postMessage({ type: REQUEST, url: absoluteUrl, requestId }, '*');
        };
    }

    window.history.pushState = createPatchedMethod(originalPushState);
    window.history.replaceState = createPatchedMethod(originalReplaceState);
}
