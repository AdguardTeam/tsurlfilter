/**
 * @file User Scripts API utilities which are exported to be used in other parts
 * of the extension.
 *
 * Add exports here carefully, because this file can be badly tree-shaken and
 * can increase the bundle size.
 */

export { getFilterName } from './get-filter-name';
export { isUserScriptsApiEnabled } from './is-user-scripts-api-enabled';
