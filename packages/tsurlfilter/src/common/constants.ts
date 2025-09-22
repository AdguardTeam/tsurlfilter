export enum ErrorStatusCodes {
    ComplexRegex = 1001,
    RuleLimit = 1002,
    RegexpRuleLimit = 1003,
    RemoveparamRegexpIsNotSupported = 1004,
    RemoveparamInversionIsNotSupported = 1005,
}

export const DOT = '.';
export const EMPTY_STRING = '';
export const SEPARATOR = '|';
export const SPACE = ' ';
export const WILDCARD = '*';

export const COMMA = ',';

export const LF = '\n';
export const CR = '\r';
export const FF = '\f';

export const TAB = '\t';

export const ESCAPE = '\\';

export const OPEN_SQUARE = '[';
export const CLOSE_SQUARE = ']';

export const RE_NUMBER = /^\d+$/;

/**
 * Prefix for ruleset name.
 */
export const RULESET_NAME_PREFIX = 'ruleset_';
