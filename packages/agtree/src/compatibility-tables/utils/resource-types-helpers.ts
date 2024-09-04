import { ResourceType } from '../schemas/resource-types';

/**
 * Map of resource types to their corresponding adblock modifier names.
 */
export const RESOURCE_TYPE_MODIFIER_MAP = new Map([
    [ResourceType.MainFrame, 'document'],
    [ResourceType.SubFrame, 'subdocument'],
    [ResourceType.Stylesheet, 'stylesheet'],
    [ResourceType.Script, 'script'],
    [ResourceType.Image, 'image'],
    [ResourceType.Font, 'font'],
    [ResourceType.Object, 'object'],
    [ResourceType.XmlHttpRequest, 'xmlhttprequest'],
    [ResourceType.Ping, 'ping'],
    [ResourceType.Media, 'media'],
    [ResourceType.WebSocket, 'websocket'],
    [ResourceType.Other, 'other'],
]);

/**
 * Checks if the given resource type is valid.
 *
 * @param resourceType Resource type to check.
 *
 * @returns `true` if the resource type is valid, `false` otherwise.
 */
export const isValidResourceType = (resourceType: string): boolean => {
    return RESOURCE_TYPE_MODIFIER_MAP.has(resourceType as ResourceType);
};
