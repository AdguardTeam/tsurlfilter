import { RequestType } from '@adguard/tsurlfilter';
import { WebRequest } from 'webextension-polyfill';

/**
 * Transform `webextension-polyfill` `WebRequest.ResourceType` to `@adguard/tsurlfilter` `RequestType` 
 */
export const transformResourceType = (resourceType: WebRequest.ResourceType): RequestType => {
    switch (resourceType) {
        case 'main_frame':
            return RequestType.Document;
        case 'sub_frame':
            return RequestType.Subdocument;
        case 'stylesheet':
            return RequestType.Stylesheet;
        case 'font':
            return RequestType.Font;
        case 'image':
            return RequestType.Image;
        case 'media':
            return RequestType.Media;
        case 'script':
            return RequestType.Script;
        case 'xmlhttprequest':
            return RequestType.XmlHttpRequest;
        case 'websocket':
            return RequestType.Websocket;
        case 'ping':
        case 'beacon':
            return RequestType.Ping;
        default:
            return RequestType.Other;
    }
};
