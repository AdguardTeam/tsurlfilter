/**
 * @file AGTree entry point.
 */

// Parser
export { RuleGenerator } from './generator/rule-generator';
export { FilterListGenerator } from './generator/filterlist-generator';

// New pipeline parser (supports element hiding and other cosmetic rules)
export { RuleParserPipeline } from './ast-builder/rule-parser';
export type { ParseOptions } from './ast-builder/options';
export type { ParserCapacity } from './ast-builder/capacity';

// AST-building convenience helpers
export {
    parseDomainList,
    parseModifier,
    parseAppList,
    parseMethodList,
    parseStealthOptionList,
} from './ast-utils/parsing';

// Filter list scanner and pipeline
export { FilterListScanner, FilterListPipeline } from './filter-list';
export type {
    ScanCallback,
    EmptyLineCallback,
    ScanErrorCallback,
    ScannedRuleInfo,
    FilterListParseOptions,
} from './filter-list';
// Re-export the intended AST node vocabulary from `./nodes` as an explicit
// allow-list. Internal helpers (`defaultLocation`, `AnyNode`, `NetworkRuleBase`,
// `ListItem`, `AnyListItem`, `InvalidRuleError`, `ConfigNode`, `UboSelector`,
// `PipeSeparator`, `CommaSeparator`, and the `Css*ParseOptions` option types)
// are intentionally kept out of the public surface. Named re-exports (instead of
// `export *`) keep the surface intentional and surface any future name clash at
// compile time.
export {
    // Discriminant enums (value + type)
    OperatorValue,
    ValueKind,
    CommentMarker,
    RuleCategory,
    ListNodeType,
    ListItemNodeType,
    CommentRuleType,
    CosmeticRuleType,
    CosmeticRuleSeparator,
    NodeType,
    AttributeSelectorOperatorValue,
    AttributeSelectorFlagValue,
    SelectorCombinatorValue,
    NetworkRuleType,
} from './nodes';
export type {
    // Base nodes
    Node,
    Location,
    LocationRange,
    Value,
    Raw,
    Parameter,
    ParameterList,
    FilterList,
    RuleBase,
    // Logical expressions
    AnyExpressionNode,
    ExpressionVariableNode,
    ExpressionOperatorNode,
    ExpressionParenthesisNode,
    // Rule unions and base rules
    AnyRule,
    InvalidRule,
    RawRule,
    EmptyRule,
    // Comment rules
    AnyCommentRule,
    CommentBase,
    CommentRule,
    MetadataCommentRule,
    ConfigCommentRule,
    PreProcessorCommentRule,
    Agent,
    AgentCommentRule,
    Hint,
    HintCommentRule,
    // Modifiers
    ModifierList,
    Modifier,
    // List items and lists
    App,
    Domain,
    Method,
    StealthOption,
    DomainList,
    AppList,
    MethodList,
    StealthOptionList,
    DomainListSeparator,
    // Cosmetic rules
    AnyCosmeticRule,
    CosmeticRule,
    CssInjectionRule,
    CssInjectionRuleBody,
    ElementHidingRule,
    ElementHidingRuleBody,
    ScriptletInjectionRule,
    ScriptletInjectionRuleBody,
    HtmlFilteringRule,
    HtmlFilteringRuleBody,
    JsInjectionRule,
    // CSS nodes and selectors
    CssDeclaration,
    CssDeclarationList,
    CssBlock,
    CssRule,
    CssAtRule,
    CssAtRulePrelude,
    TypeSelector,
    ClassSelector,
    IdSelector,
    AttributeSelectorWithoutValue,
    AttributeSelectorWithValue,
    AttributeSelector,
    PseudoClassSelector,
    SelectorCombinator,
    ComplexSelector,
    SimpleSelector,
    SelectorList,
    // Network rules
    AnyNetworkRule,
    NetworkRule,
    HostRule,
    HostnameList,
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
