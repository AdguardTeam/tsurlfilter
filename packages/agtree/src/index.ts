/**
 * @file AGTree entry point
 */

// Parser
export { RuleParser } from './parser/rule';
export {
    type Agent,
    type AgentCommentRule,
    type AnyCommentRule,
    type AnyCosmeticRule,
    type AnyExpressionNode,
    type AnyOperator,
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
    type JsInjectionRule,
    type Location,
    type LocationRange,
    type MetadataCommentRule,
    type Modifier,
    type ModifierList,
    type NetworkRule,
    type Node,
    type Parameter,
    type ParameterList,
    type PreProcessorCommentRule,
    type RuleBase,
    RuleCategory,
    type ScriptletInjectionRule,
    type ScriptletInjectionRuleBody,
    type Value,
} from './parser/common';
export { AdblockSyntaxError } from './errors/adblock-syntax-error';
export { AgentCommentRuleParser } from './parser/comment/agent-rule';
export { AgentParser } from './parser/comment/agent';
export { CommentRuleParser } from './parser/comment';
export { ConfigCommentRuleParser } from './parser/comment/inline-config';
export { CosmeticRuleParser } from './parser/cosmetic';
export { AppListParser } from './parser/misc/app-list';
export { DomainListParser } from './parser/misc/domain-list';
export { MethodListParser } from './parser/misc/method-list';
export { FilterListParser } from './parser/filterlist';
export { HintCommentRuleParser } from './parser/comment/hint-rule';
export { HintParser } from './parser/comment/hint';
export { LogicalExpressionParser } from './parser/misc/logical-expression';
export { MetadataCommentRuleParser } from './parser/comment/metadata';
export { ModifierListParser } from './parser/misc/modifier-list';
export { ModifierParser } from './parser/misc/modifier';
export { NetworkRuleParser } from './parser/network';
export { NotImplementedError } from './errors/not-implemented-error';
export { ParameterListParser } from './parser/misc/parameter-list';
export { PreProcessorCommentRuleParser } from './parser/comment/preprocessor';
export { RuleConversionError } from './errors/rule-conversion-error';

// Validator
export { modifierValidator } from './validator';

// Converter
// TODO: In a later stage, we should consider exporting some helpers as well
export { RuleConverter } from './converter';
export { FilterListConverter } from './converter/filter-list';

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
export { AdblockSyntax } from './utils/adblockers';
export { type CosmeticRuleSeparatorFinderResult, CosmeticRuleSeparatorUtils } from './utils/cosmetic-rule-separator';
export { CssTree } from './utils/csstree';
export { CssTreeNodeType, CssTreeParserContext } from './utils/csstree-constants';
export { DomainUtils } from './utils/domain';
export { type VariableTable, LogicalExpressionUtils } from './utils/logical-expression';
export { shiftLoc, locRange } from './utils/location';
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

// Constants
export { METADATA_HEADERS } from './converter/data/metadata';
export { EXT_CSS_PSEUDO_CLASSES, EXT_CSS_LEGACY_ATTRIBUTES, FORBIDDEN_CSS_FUNCTIONS } from './converter/data/css';

// Re-export everything from ECSSTree
export * as ECSSTree from '@adguard/ecss-tree';

// Version
export { version } from './version';
