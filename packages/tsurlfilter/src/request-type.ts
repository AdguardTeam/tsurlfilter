/**
 * RequestType is the request types enumeration.
 * Important: the enumeration is marked as const to avoid side effects when
 * importing it into an extension.
 */
export const RequestType = {
    /** No value is set. Syntax sugar to simplify code. */
    NotSet: 0,
    /** main frame */
    Document: 1,
    /** (iframe) $subdocument */
    SubDocument: 2, // 1 << 1
    /** (javascript, etc) $script */
    Script: 4, // 1 << 2
    /** (css) $stylesheet */
    Stylesheet: 8, // 1 << 3
    /** (flash, etc) $object */
    Object: 16, // 1 << 4
    /** (any image) $image */
    Image: 32, // 1 << 5
    /** (ajax/fetch) $xmlhttprequest */
    XmlHttpRequest: 64, // 1 << 6
    /** (video/music) $media */
    Media: 128, // 1 << 7
    /** (any custom font) $font */
    Font: 256, // 1 << 8
    /** (a websocket connection) $websocket */
    WebSocket: 512, // 1 << 9
    /** (navigator.sendBeacon()) $ping */
    Ping: 1024, // 1 << 10
    /** csp_report */
    CspReport: 2048, // 1 << 11
    /** any other request type */
    Other: 4096, // 1 << 12
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type RequestType = typeof RequestType[keyof typeof RequestType];
