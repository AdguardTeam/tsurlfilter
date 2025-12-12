/**
 * @file Compatibility tables variables and types reexport.
 */

export { modifiersCompatibilityTable } from './modifiers';
export { redirectsCompatibilityTable } from './redirects';
export { scriptletsCompatibilityTable } from './scriptlets';
export * from './types';
export * from './platforms';
export type {
    ProductRecords,
    RowByProduct,
    RowsByProduct,
} from './base';
export {
    parseRawPlatforms,
    stringifyPlatforms,
    PLATFORM_NEGATION,
    PLATFORM_SEPARATOR,
} from './schemas';
export {
    isGenericPlatform,
    hasPlatformMultipleProducts,
    getProductGenericPlatforms,
    getProductSpecificPlatforms,
    platformToAdblockProduct,
    getPlatformsByProduct,
    getPlatformId,
    getSpecificPlatformName,
    getHumanReadablePlatformName,
    getAllPlatformNames,
} from './utils/platform-helpers';
export type { PlatformsByProduct } from './utils/platform-helpers';
export {
    ResourceType,
} from './schemas/resource-type';
export {
    getResourceTypeModifier,
    isValidResourceType,
} from './utils/resource-type-helpers';
