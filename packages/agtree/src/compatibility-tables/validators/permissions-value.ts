/**
 * @file Validator for permissions value.
 */

import {
    BACKSLASH,
    CLOSE_PARENTHESIS,
    COMMA,
    EQUALS,
    OPEN_PARENTHESIS,
    SPACE,
    WILDCARD,
} from '../../utils/constants';
import { QuoteType, QuoteUtils } from '../../utils/quotes';
import { type ValidationContext, type Validator } from './types';

/**
 * One of available tokens for $permission modifier value.
 *
 * @see {@link https://w3c.github.io/webappsec-permissions-policy/#structured-header-serialization}
 */
export const PERMISSIONS_TOKEN_SELF = 'self';

/**
 * One of allowlist values for $permissions modifier.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy#allowlists}
 */
export const EMPTY_PERMISSIONS_ALLOWLIST = `${OPEN_PARENTHESIS}${CLOSE_PARENTHESIS}`;

/**
 * Allowed directives for $permissions modifier.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#permissions-modifier}
 */
const ALLOWED_PERMISSION_DIRECTIVES = new Set([
    'accelerometer',
    'ambient-light-sensor',
    'autoplay',
    'battery',
    'browsing-topics',
    'camera',
    'display-capture',
    'document-domain',
    'encrypted-media',
    'execution-while-not-rendered',
    'execution-while-out-of-viewport',
    'fullscreen',
    'gamepad',
    'geolocation',
    'gyroscope',
    'hid',
    'identity-credentials-get',
    'idle-detection',
    'join-ad-interest-group',
    'local-fonts',
    'magnetometer',
    'microphone',
    'midi',
    'payment',
    'picture-in-picture',
    'publickey-credentials-create',
    'publickey-credentials-get',
    'run-ad-auction',
    'screen-wake-lock',
    'serial',
    'speaker-selection',
    'storage-access',
    'usb',
    'web-share',
    'xr-spatial-tracking',
]);

/**
 * Checks whether the given origin is valid for Permissions allowlist.
 *
 * @param rawOrigin The raw origin.
 *
 * @returns Error message if invalid, null if valid.
 */
const isValidPermissionsOrigin = (rawOrigin: string): string | null => {
    const actualQuoteType = QuoteUtils.getStringQuoteType(rawOrigin);
    if (actualQuoteType !== QuoteType.Double) {
        return 'Double quotes should be used for origins';
    }

    const origin = QuoteUtils.removeQuotes(rawOrigin);
    try {
        new URL(origin);
    } catch (e) {
        return 'Invalid origin URL';
    }

    return null;
};

/**
 * Validates permission allowlist origins.
 *
 * @param allowlistChunks Array of allowlist chunks.
 *
 * @returns Error message if invalid, null if valid.
 */
const validatePermissionAllowlistOrigins = (allowlistChunks: string[]): string | null => {
    for (let i = 0; i < allowlistChunks.length; i += 1) {
        const chunk = allowlistChunks[i].trim();
        if (chunk.length === 0) {
            continue;
        }
        if (chunk.toLowerCase() === PERMISSIONS_TOKEN_SELF) {
            continue;
        }
        if (QuoteUtils.getStringQuoteType(chunk) !== QuoteType.Double) {
            return 'Double quotes should be used for origins';
        }
        const originError = isValidPermissionsOrigin(chunk);
        if (originError) {
            return originError;
        }
    }

    return null;
};

/**
 * Validates permission allowlist.
 *
 * @param allowlist Allowlist value.
 *
 * @returns Error message if invalid, null if valid.
 */
const validatePermissionAllowlist = (allowlist: string): string | null => {
    if (allowlist === WILDCARD || allowlist === EMPTY_PERMISSIONS_ALLOWLIST) {
        return null;
    }

    if (!(allowlist.startsWith(OPEN_PARENTHESIS) && allowlist.endsWith(CLOSE_PARENTHESIS))) {
        return 'Invalid allowlist format';
    }

    const allowlistChunks = allowlist.slice(1, -1).split(SPACE);
    return validatePermissionAllowlistOrigins(allowlistChunks);
};

/**
 * Validates single permission.
 *
 * @param permission Single permission value.
 *
 * @returns Error message if invalid, null if valid.
 */
const validateSinglePermission = (permission: string): string | null => {
    if (!permission) {
        return 'Empty permission';
    }

    if (permission.includes(COMMA)) {
        return 'Unescaped comma in permission';
    }

    const [directive, allowlist] = permission.split(EQUALS);
    if (!ALLOWED_PERMISSION_DIRECTIVES.has(directive)) {
        return 'Invalid permission directive';
    }

    return validatePermissionAllowlist(allowlist);
};

/**
 * Validates permissions_value format.
 * Used for $permissions modifier.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validatePermissionsValue = (value: string, ctx: ValidationContext): void => {
    if (!value) {
        ctx.addError('EMPTY_PERMISSIONS_VALUE');
        return;
    }

    const permissions = value.split(`${BACKSLASH}${COMMA}`);

    for (let i = 0; i < permissions.length; i += 1) {
        const permission = permissions[i].trim();

        const error = validateSinglePermission(permission);
        if (error) {
            ctx.addError('INVALID_PERMISSIONS_VALUE', { message: error });
            return;
        }
    }
};

/**
 * Permissions value validator.
 */
export const PermissionsValueValidator: Validator = {
    name: 'permissions_value',
    validate: validatePermissionsValue,
};
