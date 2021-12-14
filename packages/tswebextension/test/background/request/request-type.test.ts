import { WebRequest } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';

import { getRequestType, ContentType, RequestTypeData } from '../../../src/background/request/request-type';

describe('Request Type', () => {
    
    it('correctly maps resource type with Request and Content Type', () => {
        const types: Record<WebRequest.ResourceType, RequestTypeData> = {
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
            imageset: {
                contentType: ContentType.IMAGE,
                requestType: RequestType.Image,
            },
            object: {
                contentType: ContentType.OBJECT,
                requestType: RequestType.Object,
            },
            ping: {
                contentType: ContentType.PING,
                requestType: RequestType.Ping,
            },
            beacon: {
                contentType: ContentType.PING,
                requestType: RequestType.Ping,
            },
            font: {
                contentType: ContentType.FONT,
                requestType: RequestType.Font,
            },
            media: {
                contentType: ContentType.MEDIA,
                requestType: RequestType.Media,
            },
            websocket: {
                contentType: ContentType.WEBSOCKET,
                requestType: RequestType.Websocket,
            },
            csp_report: {
                contentType: ContentType.CSP_REPORT,
                requestType: RequestType.Other,
            },
            xmlhttprequest: {
                contentType: ContentType.XMLHTTPREQUEST,
                requestType: RequestType.XmlHttpRequest,
            },
            object_subrequest: {
                contentType: ContentType.OTHER,
                requestType: RequestType.Other,
            }, 
            xslt: {
                contentType: ContentType.OTHER,
                requestType: RequestType.Other,
            }, 
            xml_dtd: {
                contentType: ContentType.OTHER,
                requestType: RequestType.Other,
            },
            web_manifest: {
                contentType: ContentType.OTHER,
                requestType: RequestType.Other,
            },
            speculative: {
                contentType: ContentType.OTHER,
                requestType: RequestType.Other,
            },
            other: {
                contentType: ContentType.OTHER,
                requestType: RequestType.Other,
            },
        };

        for (const key in types){
            expect(
                getRequestType(key as WebRequest.ResourceType),
            ).toEqual(types[key as WebRequest.ResourceType]);
        }     
    });
});
