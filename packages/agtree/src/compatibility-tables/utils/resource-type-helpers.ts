import { isNull } from '../../utils/type-guards';
import { modifiersCompatibilityTable } from '../modifiers';
import { type AnyPlatform } from '../platforms';
import { ResourceType } from '../schemas/resource-type';

/**
 * Map of resource types to their corresponding adblock modifier names.
 *
 * @note Record type is used to ensure that all resource types are present in the map.
 */
const RESOURCE_TYPE_MODIFIER_MAP: Readonly<Record<ResourceType, string>> = Object.freeze({
    [ResourceType.MainFrame]: 'document',
    [ResourceType.SubFrame]: 'subdocument',
    [ResourceType.Stylesheet]: 'stylesheet',
    [ResourceType.Script]: 'script',
    [ResourceType.Image]: 'image',
    [ResourceType.Font]: 'font',
    [ResourceType.Object]: 'object',
    [ResourceType.XmlHttpRequest]: 'xmlhttprequest',
    [ResourceType.Ping]: 'ping',
    [ResourceType.Media]: 'media',
    [ResourceType.WebSocket]: 'websocket',
    [ResourceType.Other]: 'other',
});

/**
 * Gets the adblock modifier name for the given resource type.
 *
 * @param resourceType Resource type to get the modifier name for.
 * @param platform Platform to get the modifier for (can be specific, generic, or combined platforms).
 *
 * @returns A string containing the adblock modifier name for the given resource type
 * or `null` if the modifier could not be found.
 */
export const getResourceTypeModifier = (
    resourceType: ResourceType,
    platform: AnyPlatform,
): string | null => {
    const modifierName = RESOURCE_TYPE_MODIFIER_MAP[resourceType];

    if (!modifierName) {
        return null;
    }

    const modifierData = modifiersCompatibilityTable.getFirst(modifierName, platform);

    if (isNull(modifierData)) {
        return null;
    }

    return modifierData.name;
};

/**
 * Checks if the given resource type is valid.
 *
 * @param resourceType Resource type to check.
 *
 * @returns `true` if the resource type is valid, `false` otherwise.
 */
export const isValidResourceType = (resourceType: string): boolean => {
    return Object.values(ResourceType).includes(resourceType as ResourceType);
};
