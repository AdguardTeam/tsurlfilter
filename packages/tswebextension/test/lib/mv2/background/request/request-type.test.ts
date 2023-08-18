/* eslint-disable guard-for-in */
import { WebRequest } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';
import {
    getRequestType,
    ContentType,
    RequestTypeData,
} from '@lib/common/request-type';

describe('Request Type', () => {
    it('correctly maps resource type with Request and Content Type', () => {
        const types: Record<WebRequest.ResourceType, RequestTypeData> = {
            main_frame: {
                contentType: ContentType.Document,
                requestType: RequestType.Document,
            },
            sub_frame: {
                contentType: ContentType.Subdocument,
                requestType: RequestType.SubDocument,
            },
            stylesheet: {
                contentType: ContentType.Stylesheet,
                requestType: RequestType.Stylesheet,
            },
            script: {
                contentType: ContentType.Script,
                requestType: RequestType.Script,
            },
            image: {
                contentType: ContentType.Image,
                requestType: RequestType.Image,
            },
            imageset: {
                contentType: ContentType.Image,
                requestType: RequestType.Image,
            },
            object: {
                contentType: ContentType.Object,
                requestType: RequestType.Object,
            },
            ping: {
                contentType: ContentType.Ping,
                requestType: RequestType.Ping,
            },
            beacon: {
                contentType: ContentType.Ping,
                requestType: RequestType.Ping,
            },
            font: {
                contentType: ContentType.Font,
                requestType: RequestType.Font,
            },
            media: {
                contentType: ContentType.Media,
                requestType: RequestType.Media,
            },
            websocket: {
                contentType: ContentType.Websocket,
                requestType: RequestType.WebSocket,
            },
            csp_report: {
                contentType: ContentType.CspReport,
                requestType: RequestType.CspReport,
            },
            xmlhttprequest: {
                contentType: ContentType.XmlHttpRequest,
                requestType: RequestType.XmlHttpRequest,
            },
            object_subrequest: {
                contentType: ContentType.Other,
                requestType: RequestType.Other,
            },
            xslt: {
                contentType: ContentType.Other,
                requestType: RequestType.Other,
            },
            xml_dtd: {
                contentType: ContentType.Other,
                requestType: RequestType.Other,
            },
            web_manifest: {
                contentType: ContentType.Other,
                requestType: RequestType.Other,
            },
            speculative: {
                contentType: ContentType.Other,
                requestType: RequestType.Other,
            },
            other: {
                contentType: ContentType.Other,
                requestType: RequestType.Other,
            },
        };

        for (const key in types) {
            expect(
                getRequestType(key as WebRequest.ResourceType),
            ).toEqual(types[key as WebRequest.ResourceType]);
        }
    });
});
