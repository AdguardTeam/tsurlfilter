/**
 * RequestType is the request types enumeration
 */
export enum RequestType {
    /** main frame */
    Document = 1,
    /** (iframe) $subdocument */
    Subdocument = 1 << 1,
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
    Websocket = 1 << 9,
    /** (navigator.sendBeacon()) $ping */
    Ping = 1 << 10,
    /** (webrtc, in extension works via wrappers) $webrtc */
    Webrtc = 1 << 11,
    /** any other request type */
    Other = 1 << 12,
}
