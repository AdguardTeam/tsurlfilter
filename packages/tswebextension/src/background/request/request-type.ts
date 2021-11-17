import { RequestType } from '@adguard/tsurlfilter';
import { WebRequest } from 'webextension-polyfill';

export const enum ContentType {
    DOCUMENT = 'DOCUMENT',
    SUBDOCUMENT = 'SUBDOCUMENT',
    SCRIPT = 'SCRIPT',
    STYLESHEET = 'STYLESHEET',
    OBJECT = 'OBJECT',
    IMAGE = 'IMAGE',
    XMLHTTPREQUEST = 'XMLHTTPREQUEST',
    MEDIA = 'MEDIA',
    FONT = 'FONT',
    WEBSOCKET = 'WEBSOCKET',
    WEBRTC = 'WEBRTC',
    OTHER = 'OTHER',
    CSP = 'CSP',
    COOKIE = 'COOKIE',
    PING = 'PING',
    CSP_REPORT = 'CSP_REPORT',
}

export interface RequestTypeData {
    contentType: ContentType;
    requestType: RequestType;
}


export function getRequestType(resourceType: WebRequest.ResourceType): RequestTypeData {
    switch (resourceType){
        case 'main_frame':
            return {
                contentType: ContentType.DOCUMENT,
                requestType: RequestType.Document,
            };
        case 'sub_frame': 
            return {
                contentType: ContentType.SUBDOCUMENT,
                requestType: RequestType.Subdocument,
            };
        case 'stylesheet':
            return {
                contentType: ContentType.STYLESHEET,
                requestType: RequestType.Stylesheet,
            };
        case 'script':
            return {
                contentType: ContentType.SCRIPT,
                requestType: RequestType.Script,
            };
        case 'image':
        case 'imageset': 
            return {
                contentType: ContentType.IMAGE,
                requestType: RequestType.Image,
            };
        case 'object': 
            return {
                contentType: ContentType.OBJECT,
                requestType: RequestType.Object,
            };
        case 'xmlhttprequest': 
            return {
                contentType: ContentType.XMLHTTPREQUEST,
                requestType: RequestType.XmlHttpRequest,
            };
        case 'ping':
        case 'beacon':
            return {
                contentType: ContentType.PING,
                requestType: RequestType.Ping,
            };
        case 'font':
            return {
                contentType: ContentType.FONT,
                requestType: RequestType.Font,
            };
        case 'media':
            return {
                contentType: ContentType.MEDIA,
                requestType: RequestType.Media,
            };
        case 'websocket':
            return {
                contentType: ContentType.WEBSOCKET,
                requestType: RequestType.Websocket,
            };
        case 'csp_report': 
            return {
                contentType: ContentType.CSP_REPORT,
                requestType: RequestType.Other,
            };
        default:
            return {
                contentType: ContentType.OTHER,
                requestType: RequestType.Other,
            };      
    }
}
