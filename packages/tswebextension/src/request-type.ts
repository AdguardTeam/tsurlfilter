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
     FONT ='FONT',
     WEBSOCKET = 'WEBSOCKET',
     WEBRTC = 'WEBRTC',
     OTHER = 'OTHER',
     CSP ='CSP',
     COOKIE = 'COOKIE',
     PING = 'PING',
     CSP_REPORT = 'CSP_REPORT',
}

export interface RequestTypeData {
    contentType: ContentType;
    requestType: RequestType;
}

export const resourceToRequestTypeDataMap: Record<WebRequest.ResourceType, RequestTypeData> = {
    main_frame: {
        contentType: ContentType.DOCUMENT,
        requestType: RequestType.Document,
    },
    sub_frame: {
        contentType: ContentType.SUBDOCUMENT,
        requestType: RequestType.Subdocument,
    },
    stylesheet: {
        contentType: ContentType.STYLESHEET,
        requestType: RequestType.Stylesheet,
    },
    script: {
        contentType: ContentType.SCRIPT,
        requestType: RequestType.Script,
    },
    image: {
        contentType: ContentType.IMAGE,
        requestType: RequestType.Image,
    },
    object: {
        contentType: ContentType.OBJECT,
        requestType: RequestType.Object,
    },
    object_subrequest: {
        contentType: ContentType.OTHER,
        requestType: RequestType.Other,
    },
    xmlhttprequest: {
        contentType: ContentType.XMLHTTPREQUEST,
        requestType: RequestType.XmlHttpRequest
    },
    xslt: {
        contentType: ContentType.OTHER,
        requestType: RequestType.Other,
    },
    ping: {
        contentType: ContentType.PING,
        requestType: RequestType.Ping
    },
    beacon: {
        contentType: ContentType.PING,
        requestType: RequestType.Ping
    },
    xml_dtd: {
        contentType: ContentType.OTHER,
        requestType: RequestType.Other,
    },
    font: {
        contentType: ContentType.FONT,
        requestType: RequestType.Font,
    },
    media: {
        contentType: ContentType.MEDIA,
        requestType: RequestType.Media
    },
    websocket: {
        contentType: ContentType.WEBSOCKET,
        requestType: RequestType.Websocket
    },
    csp_report: {
        contentType: ContentType.CSP_REPORT,
        requestType: RequestType.Other,
    },
    imageset: {
        contentType: ContentType.IMAGE,
        requestType: RequestType.Image,
    },
    web_manifest: {
        contentType: ContentType.OTHER,
        requestType: RequestType.Other,
    },
    speculative: {
        contentType: ContentType.OTHER,
        requestType: RequestType.Other
    },
    other: {
        contentType: ContentType.OTHER,
        requestType: RequestType.Other
    },
}
