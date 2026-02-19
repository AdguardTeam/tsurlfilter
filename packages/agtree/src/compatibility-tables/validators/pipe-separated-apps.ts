/**
 * @file Validator for pipe-separated apps.
 */

import { AppListParser } from '../../parser/misc/app-list-parser';
import { DOT, WILDCARD } from '../../utils/constants';
import { defaultParserOptions } from '../../parser/options';
import { type ValidationContext, type Validator } from './types';
import { type AppList } from '../../nodes';

const UNDERSCORE_CODE = '_'.charCodeAt(0);
const LATIN_SMALL_A_CODE = 'a'.charCodeAt(0);
const LATIN_SMALL_Z_CODE = 'z'.charCodeAt(0);
const LATIN_CAPITAL_A_CODE = 'A'.charCodeAt(0);
const LATIN_CAPITAL_Z_CODE = 'Z'.charCodeAt(0);
const NUMBER_0_CODE = '0'.charCodeAt(0);
const NUMBER_9_CODE = '9'.charCodeAt(0);

let LOOKUP_TABLE: Uint8Array | null = null;

const getAppNameAllowedCharsLookupTable = (): Uint8Array => {
    if (LOOKUP_TABLE) {
        return LOOKUP_TABLE;
    }

    LOOKUP_TABLE = new Uint8Array(128);

    for (let i = LATIN_SMALL_A_CODE; i <= LATIN_SMALL_Z_CODE; i += 1) {
        LOOKUP_TABLE[i] = 1;
    }

    for (let i = LATIN_CAPITAL_A_CODE; i <= LATIN_CAPITAL_Z_CODE; i += 1) {
        LOOKUP_TABLE[i] = 1;
    }

    for (let i = NUMBER_0_CODE; i <= NUMBER_9_CODE; i += 1) {
        LOOKUP_TABLE[i] = 1;
    }

    LOOKUP_TABLE[UNDERSCORE_CODE] = 1;

    return LOOKUP_TABLE;
};

/**
 * Checks whether a chunk of app name is valid.
 *
 * @param chunk Chunk of app name.
 *
 * @returns True if valid, false otherwise.
 */
const isValidAppNameChunk = (chunk: string): boolean => {
    if (chunk.length === 0) {
        return false;
    }

    const lookupTable = getAppNameAllowedCharsLookupTable();

    for (let i = 0; i < chunk.length; i += 1) {
        const charCode = chunk.charCodeAt(i);
        if (lookupTable[charCode] !== 1) {
            return false;
        }
    }

    return true;
};

/**
 * Checks whether the given value is a valid app name.
 *
 * @param value App name to check.
 *
 * @returns True if valid app name, false otherwise.
 */
const isValidAppModifierValue = (value: string): boolean => {
    if (value.includes(WILDCARD)) {
        return false;
    }

    return value
        .split(DOT)
        .every((chunk) => isValidAppNameChunk(chunk));
};

/**
 * Validates pipe_separated_apps format.
 * Used for $app modifier. Does not allow wildcards.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validatePipeSeparatedApps = (value: string, ctx: ValidationContext): void => {
    if (!value) {
        ctx.addError('EMPTY_APP_LIST');
        return;
    }

    let appList: AppList;
    try {
        appList = AppListParser.parse(value, defaultParserOptions, 0);
    } catch (e: unknown) {
        if (e instanceof Error) {
            ctx.addError('APP_LIST_PARSE_ERROR', { message: e.message });
        } else {
            ctx.addError('APP_LIST_SYNTAX_ERROR');
        }
        return;
    }

    if (appList.children.length === 0) {
        ctx.addError('EMPTY_APP_LIST');
        return;
    }

    const invalidItems: string[] = [];
    for (let i = 0; i < appList.children.length; i += 1) {
        const item = appList.children[i];
        if (!isValidAppModifierValue(item.value)) {
            invalidItems.push(item.value);
        }
    }

    if (invalidItems.length > 0) {
        ctx.addError('INVALID_APP_LIST_VALUES', { values: invalidItems });
    }
};

/**
 * Pipe-separated apps validator.
 */
export const PipeSeparatedAppsValidator: Validator = {
    name: 'pipe_separated_apps',
    validate: validatePipeSeparatedApps,
};
