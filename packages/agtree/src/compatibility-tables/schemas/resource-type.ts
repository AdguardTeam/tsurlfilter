/**
 * @file Resource type schema.
 */

import zod from 'zod';

/**
 * Resource type.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ResourceType}
 */
export enum ResourceType {
    MainFrame = 'main_frame',
    SubFrame = 'sub_frame',
    Stylesheet = 'stylesheet',
    Script = 'script',
    Image = 'image',
    Font = 'font',
    Object = 'object',
    XmlHttpRequest = 'xmlhttprequest',
    Ping = 'ping',
    Media = 'media',
    WebSocket = 'websocket',
    Other = 'other',
}

/**
 * Resource type schema.
 */
export const resourceTypeSchema = zod.nativeEnum(ResourceType);
