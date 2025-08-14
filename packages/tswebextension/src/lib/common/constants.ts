/**
 * Filter ID which is used for User rules.
 */
export const USER_FILTER_ID = 0;

/**
 * Filter ID which is used for Allowlist.
 */
export const ALLOWLIST_FILTER_ID = 100;

/**
 * Custom filters identifiers starts from this number.
 */
export const CUSTOM_FILTERS_START_ID = 1000 as const;

/**
 * Filter ID for AdGuard Quick Fixes filter.
 *
 * @see {@link https://github.com/AdguardTeam/FiltersRegistry/blob/master/filters/filter_24_QuickFixes/metadata.json}
 */
export const QUICK_FIXES_FILTER_ID = 24;

/**
 * Filter ID which is used for temporarily disabled rules (as trusted)
 * for the blocking page triggered by rules.
 */
export const BLOCKING_TRUSTED_FILTER_ID = -10;

/**
 * Tab ID for background page.
 */
export const BACKGROUND_TAB_ID = -1;

/**
 * Line feed character.
 */
export const LF = '\n';

/**
 * Semicolon character.
 */
export const SEMICOLON = ';';

/**
 * Timeout used for deletion of request context data and frame context data from the storage.
 */
export const FRAME_DELETION_TIMEOUT_MS = 3000;

/**
 * Document level frame id.
 */
export const MAIN_FRAME_ID = 0;

/**
 * Value of the parent frame id if no parent frame exists.
 *
 * @see {@link https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeRequest#parentframeid}
 */
export const NO_PARENT_FRAME_ID = -1;
