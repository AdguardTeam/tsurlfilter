/**
 * RequestType is the request types enumeration
 */
export enum RequestType {
    /** main frame */
    Document = 1,
    /** (iframe) $subdocument */
    SubDocument = 1 << 1,
    /** (javascript, etc) $script */
    Script = 1 << 2,
    /** (css) $stylesheet */
    Stylesheet = 1 << 3,
    /** (flash, etc) $object */
    Object = 1 << 4,
    /** (any image) $image */
    Image = 1 << 5,
    /** (ajax/fetch) $xmlhttprequest */
    XmlHttpRequest = 1 << 6,
    /** (video/music) $media */
    Media = 1 << 7,
    /** (any custom font) $font */
    Font = 1 << 8,
    /** (a websocket connection) $websocket */
    WebSocket = 1 << 9,
    /** (navigator.sendBeacon()) $ping */
    Ping = 1 << 10,
    /** any other request type */
    Other = 1 << 11,
}
