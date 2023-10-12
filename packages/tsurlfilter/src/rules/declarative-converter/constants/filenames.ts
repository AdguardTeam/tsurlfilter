/**
 * @file This file describes the file names for the parts of the rule set that
 * will be saved to/loaded from disk.
 *
 * We split all ruleset data into two parts: one is needed for instant creating
 * ruleset, while the other is needed only when declarative filtering log
 * is enabled - to find and display source rules from raw filters.
 */

/**
 * This metadata needed for instant creating ruleset.
 */
export const METADATA_FILENAME = 'metadata.json';
/**
 * This metadata needed for lazy load some data to ruleset
 * to find and show source rules when declarative filtering log is enabled.
 */
export const LAZY_METADATA_FILENAME = 'lazy_metadata.json';
