/**
 * @file File names for the parts of the rule set that will be saved to /
 * loaded from disk.
 *
 * Ruleset data is split into two parts: one is needed for instant creating
 * ruleset, while the other is needed only when declarative filtering log
 * is enabled — to find and display source rules from raw filters.
 */

/**
 * File name for the metadata needed for instant creating ruleset.
 */
export const METADATA_FILENAME = 'metadata.json';

/**
 * File name for the metadata needed for lazy loading data to ruleset
 * to find and show source rules when declarative filtering log is enabled.
 */
export const LAZY_METADATA_FILENAME = 'lazy_metadata.json';
