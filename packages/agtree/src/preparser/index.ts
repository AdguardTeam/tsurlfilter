/**
 * @file Preparser module — structural parsing without AST materialization.
 *
 * Three-layer architecture:
 *   1. Tokenizer (existing) → token types + end positions
 *   2. Preparser (this module) → structural indices in reusable Int32Array
 *   3. Parser (in ../parser-new) → full AST objects, only when needed.
 */

export {
    type PreparserContext,
    createPreparserContext,
    initPreparserContext,
    regionEquals,
    tokenStart,
    skipWs,
    skipUntil,
    domainRecordsOffset,
    growDomainCapacity,
} from './context';

// Re-export constants and types from network rule preparser
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
    CR_DOMAIN_COUNT,
    CR_BODY_START,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAG_HAS_UBO_MODS,
    CR_SEP_KIND_SHIFT,
    CR_SEP_KIND_MASK,
    DOMAIN_RECORD_STRIDE,
    DOMAIN_FIELD_VALUE_START,
    DOMAIN_FIELD_VALUE_END,
    DOMAIN_FIELD_FLAGS,
    DOMAIN_FLAG_EXCEPTION,
    cosmeticSepLength,
    cosmeticSepTokenCount,
    cosmeticSepIsException,
    cosmeticSepToString,
} from './cosmetic/constants';
export {
    type NetworkRulePreparseResult,
    createNetworkRulePreparseResult,
} from './network/network-rule';

export {
    CosmeticSepKind,
    cosmeticSepKind,
    cosmeticSepIndex,
    findCosmeticSeparator,
} from './cosmetic-separator';
export { RuleClassifier, RuleKind } from './classifier';
export { RulePreparser } from './rule';
export {
    AgentCommentPreparser,
    HintCommentPreparser,
    matchMetadataHeader,
    MetadataCommentPreparser,
    PreprocessorCommentPreparser,
    SimpleCommentPreparser,
    CommentClassifier,
    CommentKind,
    CM_KIND,
} from './comment';
export { NetworkRulePreparser } from './network/network-rule';
export { ElementHidingPreparser } from './cosmetic/element-hiding';
export { DomainListPreparser } from './misc/domain-list';
export { ModifierListPreparser } from './misc/modifier-list';
export { ModifierPreparser } from './misc/modifier';
export { ValuePreparser } from './misc/value';
export { isPotentialNetModifier } from './misc/shared';
export {
    ParameterListPreparser,
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
    LogicalExpressionPreparser,
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
