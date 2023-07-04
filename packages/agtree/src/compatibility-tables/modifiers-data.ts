import { isUndefined } from '../utils/common';
import { rawModifiersData } from './raw-modifiers';
import {
    type ModifierData,
    type ModifierDataMap,
    type SpecificPlatformModifierData,
    SpecificKey,
} from './types';

/**
 * Prepares specific platform modifier data from raw modifiers data —
 * sets [default values] to properties that are not defined in raw data.
 *
 * [default values]: ./modifiers/README.md "Check File structure table for default values."
 *
 * @param blockerId Key in ModifierData, i.e. 'adg_os_any', 'ubo_ext_any', etc.
 * @param rawModifierData Specific platform modifier data from raw modifiers data.
 *
 * @returns Prepared specific platform modifier data where properties cannot be undefined.
 */
const prepareBlockerData = (blockerId: string, rawModifierData: ModifierData): SpecificPlatformModifierData => {
    const rawData = rawModifierData[blockerId];
    const blockerData: SpecificPlatformModifierData = {
        [SpecificKey.Name]: rawData[SpecificKey.Name],
        [SpecificKey.Aliases]: rawData[SpecificKey.Aliases] || null,
        [SpecificKey.Description]: rawData[SpecificKey.Description] || null,
        [SpecificKey.Docs]: rawData[SpecificKey.Docs] || null,
        [SpecificKey.Deprecated]: rawData[SpecificKey.Deprecated] || false,
        [SpecificKey.DeprecationMessage]: rawData[SpecificKey.DeprecationMessage] || null,
        [SpecificKey.Removed]: rawData[SpecificKey.Removed] || false,
        [SpecificKey.RemovalMessage]: rawData[SpecificKey.RemovalMessage] || null,
        [SpecificKey.Conflicts]: rawData[SpecificKey.Conflicts] || null,
        [SpecificKey.InverseConflicts]: rawData[SpecificKey.InverseConflicts] || false,
        [SpecificKey.Assignable]: rawData[SpecificKey.Assignable] || false,
        // 'negatable' should be checked whether it is undefined or not
        // because if it is 'false', default value 'true' will override it
        [SpecificKey.Negatable]: isUndefined(rawData[SpecificKey.Negatable])
            ? true
            : rawData[SpecificKey.Negatable],
        [SpecificKey.BlockOnly]: rawData[SpecificKey.BlockOnly] || false,
        [SpecificKey.ExceptionOnly]: rawData[SpecificKey.ExceptionOnly] || false,
        [SpecificKey.ValueFormat]: rawData[SpecificKey.ValueFormat] || null,
    };
    return blockerData;
};

/**
 * Prepares raw modifiers data into a data map with default values for properties
 * that are not defined in raw data.
 *
 * @returns Map of parsed and prepared modifiers data.
 */
export const getModifiersData = (): ModifierDataMap => {
    const dataMap = new Map<string, ModifierData>();

    Object.keys(rawModifiersData).forEach((modifierId: string) => {
        const rawModifierData = rawModifiersData[modifierId];

        const modifierData: ModifierData = {};

        Object.keys(rawModifierData).forEach((blockerId) => {
            modifierData[blockerId] = prepareBlockerData(blockerId, rawModifierData);
        });

        dataMap.set(modifierId, modifierData);
    });

    return dataMap;
};
