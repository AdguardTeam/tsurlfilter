import { RequestType } from '@adguard/tsurlfilter/es/request-type';
import { WebRequest } from 'webextension-polyfill';

/**
 * Request content type.
 *
 * NOTE: Do not use `const enum`,
 * because this enum is imported in extension frontend writing in js.
 */
export enum ContentType {
    Document = 'document',
    Subdocument = 'subdocument',
    Script = 'script',
    Stylesheet = 'stylesheet',
    Object = 'object',
    Image = 'image',
    XmlHttpRequest = 'xmlHttpRequest',
    Media = 'media',
    Font = 'font',
    Websocket = 'websocket',
    WebRtc = 'webRtc',
    Other = 'other',
    Csp = 'csp',
    PermissionsPolicy = 'permissionsPolicy',
    Cookie = 'cookie',
    Ping = 'ping',
    CspReport = 'cspReport',
}

export interface RequestTypeData {
    contentType: ContentType;
    requestType: RequestType;
}

/**
 * Returns request type and content type by resource type.
 *
 * @param resourceType Resource type.
 * @returns Request type and content type.
 */
export function getRequestType(resourceType: WebRequest.ResourceType): RequestTypeData {
    switch (resourceType) {
        case 'main_frame':
            return {
                contentType: ContentType.Document,
                requestType: RequestType.Document,
            };
        case 'sub_frame':
            return {
                contentType: ContentType.Subdocument,
                requestType: RequestType.SubDocument,
            };
        case 'stylesheet':
            return {
                contentType: ContentType.Stylesheet,
                requestType: RequestType.Stylesheet,
            };
        case 'script':
            return {
                contentType: ContentType.Script,
                requestType: RequestType.Script,
            };
        case 'image':
        case 'imageset':
            return {
                contentType: ContentType.Image,
                requestType: RequestType.Image,
            };
        case 'object':
            return {
                contentType: ContentType.Object,
                requestType: RequestType.Object,
            };
        case 'xmlhttprequest':
            return {
                contentType: ContentType.XmlHttpRequest,
                requestType: RequestType.XmlHttpRequest,
            };
        case 'ping':
        case 'beacon':
            return {
                contentType: ContentType.Ping,
                requestType: RequestType.Ping,
            };
        case 'font':
            return {
                contentType: ContentType.Font,
                requestType: RequestType.Font,
            };
        case 'media':
            return {
                contentType: ContentType.Media,
                requestType: RequestType.Media,
            };
        case 'websocket':
            return {
                contentType: ContentType.Websocket,
                requestType: RequestType.WebSocket,
            };
        case 'csp_report':
            return {
                contentType: ContentType.CspReport,
                requestType: RequestType.Other,
            };
        default:
            return {
                contentType: ContentType.Other,
                requestType: RequestType.Other,
            };
    }
}
