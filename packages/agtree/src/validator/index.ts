/**
 * @file Validator for modifiers.
 */

import { type ModifierData, rawModifiersData } from '../compatibility-tables';
import { Modifier } from '../parser/common';
import { ModifierParser } from '../parser/misc/modifier';
import { isUndefined } from '../utils/common';
import { StringUtils } from '../utils/string';

/**
 * Modifier data map prepared from raw modifiers data.
 */
type ModifierDataMap = Map<string, ModifierData>;

/**
 * Prepares raw modifiers data into a data map.
 *
 * @returns Map of parsed modifiers data.
 */
const getModifiersData = (): ModifierDataMap => {
    const dataMap = new Map<string, ModifierData>();

    Object.keys(rawModifiersData).forEach((modifierId: string) => {
        const modifierData = rawModifiersData[modifierId];
        dataMap.set(modifierId, modifierData);
    });

    return dataMap;
};

/**
 * Collects names and aliases for all supported modifiers.
 * Deprecated modifiers are not included.
 *
 * @param dataMap Parsed all modifiers data.
 *
 * @returns Set of supported modifier names (and their aliases).
 */
const getAllSupportedModifierNames = (dataMap: ModifierDataMap): Set<string> => {
    const names = new Set<string>();
    dataMap.forEach((modifierData: ModifierData) => {
        Object.keys(modifierData).forEach((blockerId) => {
            const blockerData = modifierData[blockerId];
            // do not include deprecated modifiers
            if (blockerData.deprecated) {
                return;
            }
            names.add(blockerData.name);
            if (isUndefined(blockerData.aliases)) {
                return;
            }
            blockerData.aliases.forEach((alias) => names.add(alias));
        });
    });
    return names;
};

/**
 * Modifier validator class.
 */
export class ModifierValidator {
    /**
     * Map of all modifiers data parsed from yaml files.
     */
    private modifiersData: ModifierDataMap;

    /**
     * List of all currently supported modifier names for any adblocker.
     * Deprecated modifiers are not included.
     */
    private supportedModifierNames: Set<string>;

    constructor() {
        // data map based on yaml files
        this.modifiersData = getModifiersData();

        this.supportedModifierNames = getAllSupportedModifierNames(this.modifiersData);
    }

    /**
     * Simply checks whether the modifier exists in any adblocker.
     *
     * @param rawModifier Modifier as string OR already parsed modifier AST node.
     *
     * @returns True if modifier exists, false otherwise.
     * If given modifier is a string and it cannot be parsed as a valid modifier,
     * e.g. 'domain=', false is returned.
     */
    public exists = (rawModifier: string | Modifier): boolean => {
        let modifier: Modifier;
        if (StringUtils.isString(rawModifier)) {
            try {
                modifier = ModifierParser.parse(rawModifier);
            } catch (e) {
                return false;
            }
        } else {
            modifier = rawModifier;
        }

        return this.supportedModifierNames.has(modifier.modifier.value);
    };
}
