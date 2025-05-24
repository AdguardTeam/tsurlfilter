/**
 * @file Compatibility tables variables and types reexport.
 */

export { modifiersCompatibilityTable } from './modifiers.js';
export { redirectsCompatibilityTable } from './redirects.js';
export { scriptletsCompatibilityTable } from './scriptlets.js';
export * from './types.js';
export * from './platforms.js';
export type {
    ProductRecords,
    RowByProduct,
    RowsByProduct,
} from './base.js';
export { parseRawPlatforms } from './schemas/index.js';
export {
    isGenericPlatform,
    getPlatformId,
    getSpecificPlatformName,
} from './utils/platform-helpers.js';
export {
    ResourceType,
} from './schemas/resource-type.js';
export {
    getResourceTypeModifier,
    isValidResourceType,
} from './utils/resource-type-helpers.js';
