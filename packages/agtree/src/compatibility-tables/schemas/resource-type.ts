/**
 * @file Resource type schema.
 */

import zod from 'zod';

/**
 * Resource type.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ResourceType}
 */
export const ResourceType = {
    MainFrame: 'main_frame',
    SubFrame: 'sub_frame',
    Stylesheet: 'stylesheet',
    Script: 'script',
    Image: 'image',
    Font: 'font',
    Object: 'object',
    XmlHttpRequest: 'xmlhttprequest',
    Ping: 'ping',
    Media: 'media',
    WebSocket: 'websocket',
    Other: 'other',
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ResourceType = typeof ResourceType[keyof typeof ResourceType];

/**
 * Resource type schema.
 */
export const resourceTypeSchema = zod.nativeEnum(ResourceType);
