export { type ILogger, logger, setLogger } from './logger';
export { cleanUrlParamByRegExp, getRelativeUrl, isHttpOrWsRequest } from './url';
export {
    splitByDelimiterWithEscapeCharacter,
    startsAtIndexWith,
    hasUnquotedSubstring,
    fastHash,
    indexOfAny,
    replaceAll,
    stringArraysEquals,
    stringArraysHaveIntersection,
    hasSpaces,
    isString,
    unescapeChar,
    findNextLineBreakIndex,
} from './string-utils';
export { getBitCount, countEnabledBits } from './bit-utils';
export {
    getFilterName,
    getFilterBinaryName,
    getFilterConversionMapName,
    getFilterSourceMapName,
    getIdFromFilterName,
} from './resource-names';
export { RuleSyntaxUtils } from './rule-syntax-utils';
