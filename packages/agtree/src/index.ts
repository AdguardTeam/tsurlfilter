/**
 * @file AGTree entry point.
 */

// Parser
export { RuleGenerator } from './generator/rule-generator';

// New pipeline parser (supports element hiding and other cosmetic rules)
export { RuleParserPipeline } from './ast-builder/rule-parser';
export type { ParseOptions } from './ast-builder/options';
export type { ParserCapacity } from './ast-builder/capacity';

// AST-building convenience helpers
export { parseDomainList } from './ast-utils/parsing';

// Filter list scanner and pipeline
export { FilterListScanner, FilterListPipeline } from './filter-list';
export type {
    ScanCallback,
    EmptyLineCallback,
    ScanErrorCallback,
    ScannedRuleInfo,
    FilterListParseOptions,
} from './filter-list';
export {
    type Agent,
    type AgentCommentRule,
    type AnyCommentRule,
    type AnyCosmeticRule,
    type AnyExpressionNode,
    type AnyRule,
    type CommentBase,
    CommentMarker,
    type CommentRule,
    CommentRuleType,
    type ConfigCommentRule,
    type CosmeticRule,
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type CssInjectionRule,
    type CssInjectionRuleBody,
    type Domain,
    type DomainList,
    type DomainListSeparator,
    type ElementHidingRule,
    type ElementHidingRuleBody,
    type EmptyRule,
    type ExpressionOperatorNode,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    type FilterList,
    type Hint,
    type HintCommentRule,
    type HtmlFilteringRule,
    type HtmlFilteringRuleBody,
    type InvalidRule,
    type SelectorList,
    type SelectorCombinatorValue,
    type JsInjectionRule,
    type Location,
    type LocationRange,
    type MetadataCommentRule,
    type Modifier,
    type ModifierList,
    type NetworkRule,
    type Node,
    type ParameterList,
    type PreProcessorCommentRule,
    type RuleBase,
    RuleCategory,
    type ScriptletInjectionRule,
    type ScriptletInjectionRuleBody,
    type Value,
    NetworkRuleType,
    type HostnameList,
    type HostRule,
    type AnyNetworkRule,
} from './nodes';
export { AdblockSyntaxError } from './errors/adblock-syntax-error';
export {
    CapacityOverflowError,
    type CapacityRegion,
} from './errors/capacity-overflow-error';
export {
    MAX_DOMAIN_CAPACITY,
    MAX_MODIFIER_CAPACITY,
    MAX_SCRIPTLET_BODY_CAPACITY,
    MAX_TOKEN_CAPACITY,
} from './limits';
export { NotImplementedError } from './errors/not-implemented-error';
export { RuleConversionError } from './errors/rule-conversion-error';

// Validator
export { modifierValidator } from './validator';

// Export converter's entry point
export * from './converter';

// Utils
export {
    ADG_SCRIPTLET_MASK,
    AGLINT_COMMAND_PREFIX,
    COMMA_DOMAIN_LIST_SEPARATOR,
    NEGATION_MARKER,
    HINT_MARKER,
    IF,
    INCLUDE,
    MODIFIERS_SEPARATOR,
    MODIFIER_ASSIGN_OPERATOR,
    PIPE_MODIFIER_SEPARATOR,
    NETWORK_RULE_EXCEPTION_MARKER,
    NETWORK_RULE_SEPARATOR,
    PREPROCESSOR_MARKER,
    SAFARI_CB_AFFINITY,
    UBO_SCRIPTLET_MASK,
} from './utils/constants';
export { AdblockSyntax, AdblockProduct, getHumanReadableProductName } from './utils/adblockers';
export {
    hasAllProducts,
    hasProduct,
    isUnknown,
    SYNTAX_ABP,
    SYNTAX_ADG,
    SYNTAX_ALL,
    SYNTAX_UBO,
    SYNTAX_UNKNOWN,
} from './utils/syntax-flags';
export type { SyntaxFlags } from './utils/syntax-flags';
export { type CosmeticRuleSeparatorFinderResult, CosmeticRuleSeparatorUtils } from './utils/cosmetic-rule-separator';
export { DomainUtils } from './utils/domain';
export { type VariableTable, LogicalExpressionUtils } from './utils/logical-expression';
export {
    ADBLOCK_URL_START,
    ADBLOCK_URL_START_REGEX,
    ADBLOCK_URL_SEPARATOR,
    ADBLOCK_URL_SEPARATOR_REGEX,
    ADBLOCK_WILDCARD,
    ADBLOCK_WILDCARD_REGEX,
    SPECIAL_REGEX_SYMBOLS,
    RegExpUtils,
} from './utils/regexp';
export {
    QuoteType,
    QuoteUtils,
} from './utils/quotes';
export { type Position, PositionProvider } from './utils/position-provider';
export { RuleCategorizer } from './utils/categorizer';

// CSS utilities
export { hasNativeCssPseudoClass } from './utils/css';

// Constants
export {
    NATIVE_CSS_PSEUDO_CLASSES,
    REMOVE_PROPERTY,
} from './converter/data/css';

// Compatibility tables

export {
    Platform,
    PlatformExpressionEvaluator,
    modifiersCompatibilityTable,
    redirectsCompatibilityTable,
    scriptletsCompatibilityTable,
} from './compatibility-tables';

// Version
export { AGTREE_VERSION } from './version';
