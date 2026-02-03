/**
 * @file AGTree entry point
 */

// Parser
export { RuleParser } from './parser/rule-parser';
export { RuleGenerator } from './generator/rule-generator';
export { type OnParseError, defaultParserOptions, type ParserOptions } from './parser/options';

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
export { AgentCommentParser } from './parser/comment/agent-comment-parser';
export { AgentParser } from './parser/comment/agent-parser';
export { CommentParser } from './parser/comment/comment-parser';
export { ConfigCommentParser } from './parser/comment/config-comment-parser';
export { CosmeticRuleParser } from './parser/cosmetic/cosmetic-rule-parser';
export { AppListParser } from './parser/misc/app-list-parser';
export { DomainListParser } from './parser/misc/domain-list-parser';
export { MethodListParser } from './parser/misc/method-list-parser';
export { StealthOptionListParser } from './parser/misc/stealth-option-list-parser';
export { FilterListParser } from './parser/filterlist-parser';
export { HintCommentParser } from './parser/comment/hint-comment-parser';
export { HintParser } from './parser/comment/hint-parser';
export { LogicalExpressionParser } from './parser/misc/logical-expression-parser';
export { MetadataCommentParser } from './parser/comment/metadata-comment-parser';
export { ModifierListParser } from './parser/misc/modifier-list';
export { ModifierParser } from './parser/misc/modifier-parser';
export { NetworkRuleParser } from './parser/network/network-rule-parser';
export { NotImplementedError } from './errors/not-implemented-error';
export { ParameterListParser } from './parser/misc/parameter-list-parser';
export { HostRuleParser } from './parser/network/host-rule-parser';
export { PreProcessorCommentParser } from './parser/comment/preprocessor-parser';
export { RuleConversionError } from './errors/rule-conversion-error';
export { BinarySchemaMismatchError } from './errors/binary-schema-mismatch-error';

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
export { CssTokenStream } from './parser/css/css-token-stream';

export {
    GenericPlatform,
    SpecificPlatform,
    modifiersCompatibilityTable,
    redirectsCompatibilityTable,
    scriptletsCompatibilityTable,
    parseRawPlatforms,
    type CompatibilityTable,
    type CompatibilityTableRow,
    type ProductRecords,
    type RowByProduct,
    type RowsByProduct,
    isGenericPlatform,
    getPlatformId,
    getSpecificPlatformName,
    hasPlatformMultipleProducts,
    getProductGenericPlatforms,
    getProductSpecificPlatforms,
    platformToAdblockProduct,
    getPlatformsByProduct,
    getHumanReadablePlatformName,
    getAllPlatformNames,
    ResourceType,
    getResourceTypeModifier,
    isValidResourceType,
    stringifyPlatforms,
    type PlatformsByProduct,
    type AnyPlatform,
    PLATFORM_NEGATION,
    PLATFORM_SEPARATOR,
} from './compatibility-tables';

// Version
export { AGTREE_VERSION } from './version';
