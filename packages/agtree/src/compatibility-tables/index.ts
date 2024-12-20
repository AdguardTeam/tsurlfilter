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
export { parseRawPlatforms } from './schemas';
export {
    isGenericPlatform,
    getPlatformId,
    getSpecificPlatformName,
} from './utils/platform-helpers';
export {
    ResourceType,
} from './schemas/resource-type';
export {
    getResourceTypeModifier,
    isValidResourceType,
} from './utils/resource-type-helpers';
