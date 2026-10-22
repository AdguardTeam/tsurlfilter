/**
 * Reserved URL of the synchronous canvas protection delivery in Chromium MV2.
 *
 * The content script requests it with a synchronous XHR, and the background page
 * answers with a redirect to the page script. The `.invalid` top-level domain
 * never resolves (RFC 2606), so an unanswered request fails fast without reaching
 * any server.
 *
 * The module imports nothing, because the content script bundle imports it too.
 *
 * TODO: remove when Chromium MV2 is no longer supported.
 */
export class CanvasDeliveryUrl {
    /**
     * URL the content script requests.
     */
    public static readonly URL = 'https://tswebextension.invalid/canvas-protection';

    /**
     * Match pattern of the background page listener.
     */
    public static readonly PATTERN = '*://tswebextension.invalid/*';

    /**
     * Any web URL on the reserved host.
     */
    private static readonly RESERVED_URL_RE = /^(?:https?|wss?):\/\/tswebextension\.invalid(?::\d+)?\//;

    /**
     * Checks whether a request goes to the reserved host.
     *
     * @param url Request URL.
     *
     * @returns True if the URL is on the reserved host.
     */
    public static isReserved(url: string): boolean {
        return CanvasDeliveryUrl.RESERVED_URL_RE.test(url);
    }
}

/**
 * Isolated-world flag set by whichever canvas protection delivery runs first in
 * a document: the synchronous page script insertion of the content script or
 * the commit-time fallback injected by the background page. The other one then
 * does nothing.
 */
export enum CanvasDeliveryGuard {
    Delivered = 'tswebextensionCanvasDelivered',
}
