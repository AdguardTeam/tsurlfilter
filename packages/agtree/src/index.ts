/**
 * @file AGTree entry point.
 */

// Parser (legacy)
export { RuleParser } from './parser-legacy/rule-parser';
export { RuleGenerator } from './generator/rule-generator';
export { type OnParseError, defaultParserOptions, type ParserOptions } from './parser-legacy/options';

// New pipeline parser (supports element hiding and other cosmetic rules)
export { RuleParserPipeline } from './ast-builder/rule-parser';
export type { ParseOptions } from './ast-builder/options';
export type { ParserCapacity } from './ast-builder/capacity';

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
export { AgentCommentParser } from './parser-legacy/comment/agent-comment-parser';
export { AgentParser } from './parser-legacy/comment/agent-parser';
export { CommentParser } from './parser-legacy/comment/comment-parser';
export { ConfigCommentParser } from './parser-legacy/comment/config-comment-parser';
export { CosmeticRuleParser } from './parser-legacy/cosmetic/cosmetic-rule-parser';
export { AppListParser } from './parser-legacy/misc/app-list-parser';
export { DomainListParser } from './parser-legacy/misc/domain-list-parser';
export { MethodListParser } from './parser-legacy/misc/method-list-parser';
export { StealthOptionListParser } from './parser-legacy/misc/stealth-option-list-parser';
export { FilterListParser } from './parser-legacy/filterlist-parser';
export { HintCommentParser } from './parser-legacy/comment/hint-comment-parser';
export { HintParser } from './parser-legacy/comment/hint-parser';
export { LogicalExpressionParser } from './parser-legacy/misc/logical-expression-parser';
export { MetadataCommentParser } from './parser-legacy/comment/metadata-comment-parser';
export { ModifierListParser } from './parser-legacy/misc/modifier-list';
export { ModifierParser } from './parser-legacy/misc/modifier-parser';
export { NetworkRuleParser } from './parser-legacy/network/network-rule-parser';
export { NotImplementedError } from './errors/not-implemented-error';
export { ParameterListParser } from './parser-legacy/misc/parameter-list-parser';
export { HostRuleParser } from './parser-legacy/network/host-rule-parser';
export { PreProcessorCommentParser } from './parser-legacy/comment/preprocessor-parser';
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

// Constants
export {
    NATIVE_CSS_PSEUDO_CLASSES,
    REMOVE_PROPERTY,
} from './converter/data/css';

// CSS utilities
export { CssTokenStream } from './parser-legacy/css/css-token-stream';

export {
    Platform,
    PlatformExpressionEvaluator,
    modifiersCompatibilityTable,
    redirectsCompatibilityTable,
    scriptletsCompatibilityTable,
} from './compatibility-tables';

// Version
export { AGTREE_VERSION } from './version';
