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
} from './types';

export {
    CosmeticSepKind,
    cosmeticSepKind,
    cosmeticSepIndex,
    findCosmeticSeparator,
} from './cosmetic-separator';
export { RuleClassifier, RuleKind } from './classifier';
export { RulePreparser } from './rule';
export * from './comment';
export { NetworkRulePreparser } from './network-rule';
export { ModifierListPreparser } from './modifier-list';
export { ModifierPreparser } from './modifier';
export { ValuePreparser } from './value';
export { isPotentialNetModifier } from './shared';

export { NetworkRuleAstParser, type PreparserParseOptions } from '../parser-new/network-rule';
export { ModifierListParser } from '../parser-new/modifier-list';
export { ModifierParser } from '../parser-new/modifier';
export { ValueParser } from '../parser-new/value';
export { NetworkRuleParser } from '../parser-new/network-rule-parser';
