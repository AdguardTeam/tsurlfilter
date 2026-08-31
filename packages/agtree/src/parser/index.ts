/**
 * @file Public composition surface of the structural parser.
 *
 * Advanced, zero-allocation API for callers that reuse a ParserContext.
 * Internal buffer-layout constants (offsets/strides/bit flags) are
 * intentionally NOT exported — they are implementation details of ctx.data.
 */

// Context lifecycle
export {
    type ParserContext,
    createParserContext,
    initParserContext,
} from './context';

// Classification
export { RuleClassifier, RuleKind } from './classifier';
export {
    cosmeticSepTokenCount,
    cosmeticSepStartIndex,
    findCosmeticSeparator,
} from './cosmetic-separator';

// Structural parser classes (compose over token sub-ranges)
export { StructuralRuleParser } from './rule';
export type { RuleParserOptions } from './rule';
export { NetworkRuleParser } from './network/network-rule';
export { ElementHidingParser } from './cosmetic/element-hiding';
export { AdgCssInjectionParser } from './cosmetic/css-injection';
export { DomainListParser } from './misc/domain-list';
export { ModifierListParser } from './misc/modifier-list';
export { ModifierParser } from './misc/modifier';
export { ValueParser } from './misc/value';
export { ParameterListParser } from './misc/parameter-list';
export { LogicalExpressionParser } from './misc/logical-expression';
export { SelectorListParser } from './css/selector-list';
export { CssAtRuleParser } from './css/atrule';
export {
    AgentCommentParser,
    HintCommentParser,
    MetadataCommentParser,
    PreprocessorCommentParser,
    SimpleCommentParser,
    CommentParser,
    CommentKind,
} from './comment';

// Per-parser buffer-sizing constants (needed to pre-size shared ctx.data
// for sub-range composition — the ONLY layout-related numbers that are public)
export { SL_MIN_DATA_SLOTS } from './css/selector-list';
export { CSS_INJ_MIN_DATA_SLOTS } from './cosmetic/constants';
export { AT_MIN_DATA_SLOTS } from './css/atrule';
