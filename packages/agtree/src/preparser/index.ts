/**
 * @file Preparser module — structural parsing without AST materialization.
 *
 * Three-layer architecture:
 *   1. Tokenizer (existing) → token types + end positions
 *   2. Preparser (this module) → structural indices in reusable Int32Array
 *   3. Parser (in ../parser-new) → full AST objects, only when needed
 */

export {
    type PreparserContext,
    createPreparserContext,
    initPreparserContext,
    regionEquals,
    tokenStart,
    skipWs,
    skipUntil,
} from './context';

export {
    NR_FLAGS,
    NR_PATTERN_START,
    NR_PATTERN_END,
    NR_SEPARATOR_INDEX,
    NR_MODIFIER_COUNT,
    NR_HEADER_SIZE,
    FLAG_EXCEPTION,
    MOD_STRIDE,
    MOD_NAME_START,
    MOD_NAME_END,
    MOD_FLAGS,
    MOD_VALUE_START,
    MOD_VALUE_END,
    MOD_FLAG_NEGATED,
    NO_VALUE,
    type NetworkRulePreparseResult,
    createNetworkRulePreparseResult,
} from './network/types';

export {
    CosmeticSepKind,
    cosmeticSepKind,
    cosmeticSepIndex,
    findCosmeticSeparator,
} from './cosmetic-separator';
export { RuleClassifier, RuleKind } from './classifier';
export { RulePreparser } from './rule';
export * from './comment';
export { NetworkRulePreparser } from './network/network-rule';
export { ModifierListPreparser } from './misc/modifier-list';
export { ModifierPreparser } from './misc/modifier';
export { ValuePreparser } from './misc/value';
export { isPotentialNetModifier } from './misc/shared';
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
