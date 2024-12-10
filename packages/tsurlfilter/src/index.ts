export {
    CompatibilityTypes,
    type IConfiguration,
    config,
    isCompatibleWith,
    setConfiguration,
} from './configuration';

export {
    CosmeticEngine,
    CosmeticResult,
    CosmeticOption,
    NetworkEngine,
    DnsEngine,
    DnsResult,
    Engine,
    MatchingResult,
} from './engine';

export {
    BufferRuleList,
    PREPROCESSOR_AGTREE_OPTIONS,
    FilterListPreprocessor,
    filterListConversionMapValidator,
    type FilterListConversionMap,
    filterListChunksValidator,
    preprocessedFilterListValidator,
    type PreprocessedFilterList,
    LIST_ID_MAX_VALUE,
    type IRuleList,
    RuleStorage,
    filterListSourceMapValidator,
    type FilterListSourceMap,
    getRuleSourceText,
    getRuleSourceIndex,
    createAllowlistRuleList,
} from './filterlist';

export { Request, type RequestType, RequestTypes } from './request';

export {
    type ScriptletData,
    type ScriptletsProps,
    CosmeticRule,
    NetworkRuleOption,
    NetworkRuleGroupOptions,
    NetworkRule,
    HostRule,
    RULE_INDEX_NONE,
    type IRule,
    IndexedRule,
    IndexedStorageRule,
    RuleFactory,
    SimpleRegex,
    NETWORK_RULE_OPTIONS,
    OPTIONS_DELIMITER,
    MASK_ALLOWLIST,
    NOT_MARK,
    ESCAPE_CHARACTER,
} from './rules';

export {
    RemoveHeaderModifier,
    RemoveParamModifier,
    CookieModifier,
    ReplaceModifier,
    PermissionsModifier,
    PERMISSIONS_POLICY_HEADER_NAME,
    CspModifier,
    CSP_HEADER_NAME,
    MethodModifier,
    HTTPMethod,
    StealthModifier,
    StealthOptionName,
    STEALTH_MODE_FILTER_ID,
} from './modifiers';

export {
    type ILogger,
    logger,
    setLogger,
    cleanUrlParamByRegExp,
    getRelativeUrl,
    isHttpOrWsRequest,
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
    getBitCount, countEnabledBits,
    getFilterName,
    getFilterBinaryName,
    getFilterConversionMapName,
    getFilterSourceMapName,
    getIdFromFilterName,
    RuleSyntaxUtils,
} from './utils';

// Export version.
export { TSURLFILTER_VERSION } from './version';
