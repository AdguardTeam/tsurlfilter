/**
 * Name of the Content-Security-Policy header.
 */
export const CSP_HEADER_NAME = 'Content-Security-Policy';

/**
 * Name of the Permissions-Policy header.
 */
export const PERMISSIONS_POLICY_HEADER_NAME = 'Permissions-Policy';

/**
 * Enclose regex in two backslashes to mark a regex rule.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#regular-expressions-support}
 */
export const MASK_REGEX_RULE = '/';

/**
 * This is a wildcard character. It is used to represent "any set of characters".
 * This can also be an empty string or a string of any length.
 */
export const MASK_ANY_CHARACTER = '*';

/**
 * Space character.
 */
export const SPACE_CHARACTER = ' ';
