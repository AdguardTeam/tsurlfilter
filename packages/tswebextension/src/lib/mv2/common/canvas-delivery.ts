/**
 * Reserved URLs of the synchronous canvas protection delivery in Chromium MV2.
 *
 * The content script requests the URL of its extension with a synchronous XHR, and
 * the background page answers with a redirect to the page script. Each extension
 * has its own host, so extensions built on this library do not answer each other.
 *
 * The URL uses port 1, which browsers refuse to connect to: a request that no listener
 * answers, e.g. while the background page is not running yet, fails locally with
 * `ERR_UNSAFE_PORT` before any DNS lookup or connection. The `.invalid` top-level domain
 * (RFC 2606) also never resolves.
 *
 * The module imports nothing, because the content script bundle imports it too.
 *
 * TODO: remove when Chromium MV2 is no longer supported.
 */
export class CanvasDeliveryUrl {
    private static readonly HOST = 'tswebextension.invalid';

    /**
     * Any web URL on a reserved host of any extension.
     */
    private static readonly RESERVED_URL_RE = /^(?:https?|wss?):\/\/(?:[^/?#]+\.)?tswebextension\.invalid(?::\d+)?\//;

    /**
     * Returns the URL the content script requests.
     *
     * @param extensionId ID of the extension.
     *
     * @returns URL on the reserved host of the extension.
     */
    public static getUrl(extensionId: string): string {
        return `https://${extensionId}.${CanvasDeliveryUrl.HOST}:1/canvas-protection`;
    }

    /**
     * Returns the match pattern of the background page listener. Match patterns ignore ports.
     *
     * @param extensionId ID of the extension.
     *
     * @returns Pattern of the reserved host of the extension.
     */
    public static getPattern(extensionId: string): string {
        return `*://${extensionId}.${CanvasDeliveryUrl.HOST}/*`;
    }

    /**
     * Checks whether a request goes to a reserved host of any extension.
     *
     * @param url Request URL.
     *
     * @returns True if the URL is on a reserved host.
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
