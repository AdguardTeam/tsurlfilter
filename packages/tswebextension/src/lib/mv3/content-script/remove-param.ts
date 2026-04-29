/**
 * @file
 * IMPORTANT: This file should be listed inside 'sideEffects' field
 * in the package.json, because it has side effects: we do not export anything
 * from it outside, just evaluate the code (via injection).
 *
 * This script is dynamically registered via
 * `chrome.scripting.registerContentScripts` with `world: 'MAIN'` so that
 * it patches `history.pushState` / `history.replaceState` in the page's
 * JavaScript context (not the isolated content-script world).
 */
import { patchHistoryForRemoveParam } from '../../common/content-script/remove-param-main-world';

patchHistoryForRemoveParam();
