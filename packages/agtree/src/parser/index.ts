/**
 * @file Parser module — structural parsing without AST materialization.
 *
 * Three-layer architecture:
 *   1. Tokenizer (existing) → token types + end positions
 *   2. Parser (this module) → structural indices in reusable Int32Array
 *   3. AST builder (in ../ast-builder) → full AST objects, only when needed.
 */

export {
    type ParserContext,
    createParserContext,
    initParserContext,
    MAX_MODIFIER_RECORD_STRIDE,
    regionEquals,
    tokenStart,
    skipWs,
    skipUntil,
    domainRecordsOffset,
} from './context';

// Re-export constants and types from network rule parser
export {
    NR_FLAGS_OFFSET,
    NR_PATTERN_START_OFFSET,
    NR_PATTERN_END_OFFSET,
    NR_SEPARATOR_INDEX_OFFSET,
    NR_MODIFIER_COUNT_OFFSET,
    NR_MODIFIER_RECORDS_OFFSET,
    NR_FLAG_EXCEPTION,
    MODIFIER_RECORD_STRIDE,
    MODIFIER_FIELD_NAME_START,
    MODIFIER_FIELD_NAME_END,
    MODIFIER_FIELD_FLAGS,
    MODIFIER_FIELD_VALUE_START,
    MODIFIER_FIELD_VALUE_END,
    MODIFIER_FLAG_NEGATED,
    NO_VALUE,
} from './network/constants';
export {
    CR_FLAGS_OFFSET,
    CR_SEP_SOURCE_START,
    CR_SEP_LEN_SHIFT,
    CR_SEP_LEN_MASK,
    CR_DOMAIN_COUNT,
    CR_BODY_START,
    CR_BODY_START_TI,
    CR_MODIFIER_RECORDS_OFFSET,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAG_HAS_UBO_MODS,
    UBO_MODIFIER_RECORD_STRIDE,
    UBO_MOD_FIELD_NAME_START,
    UBO_MOD_FIELD_NAME_END,
    UBO_MOD_FIELD_FLAGS,
    UBO_MOD_FIELD_VALUE_START,
    UBO_MOD_FIELD_VALUE_END,
    UBO_MOD_FIELD_SRC_START,
    UBO_MOD_FIELD_SRC_END,
    CR_UBO_MODS_OFFSET,
    UBO_MOD_BIT_MATCHES_PATH,
    UBO_MOD_BIT_MATCHES_MEDIA,
    UBO_MOD_BIT_STYLE,
    UBO_MOD_BIT_REMOVE,
    DOMAIN_RECORD_STRIDE,
    DOMAIN_FIELD_VALUE_START,
    DOMAIN_FIELD_VALUE_END,
    DOMAIN_FIELD_FLAGS,
    DOMAIN_FLAG_EXCEPTION,
    CR_SEP_KIND_ADG_CSS_INJECTION,
    CSS_INJ_FLAGS,
    CSS_INJ_FLAG_HAS_MEDIA,
    CSS_INJ_FLAG_REMOVE,
    CSS_INJ_MEDIA_QUERY_START,
    CSS_INJ_MEDIA_QUERY_END,
    CSS_INJ_MEDIA_OPEN_BRACE_TI,
    CSS_INJ_MEDIA_CLOSE_BRACE_TI,
    CSS_INJ_SL_SOURCE_START,
    CSS_INJ_SL_SOURCE_END,
    CSS_INJ_SL_START_TI,
    CSS_INJ_SL_END_TI,
    CSS_INJ_OPEN_BRACE_TI,
    CSS_INJ_CLOSE_BRACE_TI,
    CSS_INJ_DL_SOURCE_START,
    CSS_INJ_DL_SOURCE_END,
    CSS_INJ_DL_START_TI,
    CSS_INJ_DL_END_TI,
    CSS_INJ_HEADER_SIZE,
    CSS_INJ_MIN_DATA_SLOTS,
} from './cosmetic/constants';

export {
    cosmeticSepTokenCount,
    cosmeticSepStartIndex,
    findCosmeticSeparator,
} from './cosmetic-separator';
export { RuleClassifier, RuleKind } from './classifier';

// CSS selector list parser
export {
    SelectorListParser,
    ChildKind,
    COMBINATOR_DESCENDANT,
    COMBINATOR_CHILD,
    COMBINATOR_NEXT_SIBLING,
    COMBINATOR_SUBSEQUENT_SIBLING,
    CHILD_STRIDE,
    CHILD_FIELD_KIND,
    CHILD_FIELD_SOURCE_START,
    CHILD_FIELD_SOURCE_END,
    CHILD_FIELD_0,
    CHILD_FIELD_1,
    CHILD_FIELD_2,
    CHILD_FIELD_3,
    CHILD_FIELD_4,
    CHILD_FIELD_5,
    CHILD_FIELD_6,
    CHILD_FIELD_7,
    COMPLEX_STRIDE,
    COMPLEX_FIELD_CHILD_COUNT,
    COMPLEX_FIELD_SOURCE_START,
    COMPLEX_FIELD_SOURCE_END,
    SL_HEADER_SIZE,
    SL_COUNT_OFFSET,
    SL_FLAGS_OFFSET,
    SL_MIN_DATA_SLOTS,
    DEFAULT_MAX_COMPLEX,
    DEFAULT_MAX_CHILDREN,
} from './css/selector-list';
export { RuleParser } from './rule';
export type { RuleParserOptions } from './rule';
export {
    AgentCommentParser,
    HintCommentParser,
    matchMetadataHeader,
    MetadataCommentParser,
    PreprocessorCommentParser,
    SimpleCommentParser,
    CommentParser,
    CommentKind,
    CM_KIND,
} from './comment';
export { NetworkRuleParser } from './network/network-rule';
export { ElementHidingParser } from './cosmetic/element-hiding';
export { AdgCssInjectionParser } from './cosmetic/css-injection';
export { DomainListParser } from './misc/domain-list';
export { ModifierListParser } from './misc/modifier-list';
export { ModifierParser } from './misc/modifier';
export { ValueParser } from './misc/value';
export { isPotentialNetModifier } from './misc/shared';
export {
    ParameterListParser,
    PL_BUFFER_SIZE,
    PL_COUNT,
    PL_HEADER,
    PL_LIST_END,
    PL_LIST_START,
    PL_MAX_PARAMS,
    PL_PARAM_END,
    PL_PARAM_START,
    PL_STRIDE,
} from './misc/parameter-list';

export {
    LogicalExpressionParser,
    LE_ROOT,
    LE_COUNT,
    LE_HEADER,
    LE_STRIDE,
    LE_KIND,
    LE_SRC_START,
    LE_SRC_END,
    LE_LEFT,
    LE_RIGHT,
    LE_MAX_NODES,
    LE_BUFFER_SIZE,
    LE_KIND_VAR,
    LE_KIND_NOT,
    LE_KIND_AND,
    LE_KIND_OR,
    LE_KIND_PAR,
} from './misc/logical-expression';

export {
    CssAtRuleParser,
    AT_HEADER_SIZE,
    AT_MIN_DATA_SLOTS,
    AT_NO_VALUE,
    AT_SOURCE_START,
    AT_NAME_SOURCE_START,
    AT_NAME_SOURCE_END,
    AT_NAME_START_TI,
    AT_NAME_END_TI,
    AT_PRELUDE_SOURCE_START,
    AT_PRELUDE_SOURCE_END,
    AT_PRELUDE_START_TI,
    AT_PRELUDE_END_TI,
    AT_OPEN_BRACE_POS,
    AT_OPEN_BRACE_TI,
    AT_CLOSE_BRACE_POS,
    AT_CLOSE_BRACE_TI,
    AT_BLOCK_START_TI,
    AT_BLOCK_END_TI,
} from './css/atrule';
