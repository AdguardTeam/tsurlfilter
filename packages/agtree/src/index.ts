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
export { AdblockSyntaxError } from './parser/errors/adblock-syntax-error';
export { AgentCommentRuleParser } from './parser/comment/agent-rule';
export { AgentParser } from './parser/comment/agent';
export { CommentRuleParser } from './parser/comment';
export { ConfigCommentRuleParser } from './parser/comment/inline-config';
export { CosmeticRuleParser } from './parser/cosmetic';
export { DomainListParser } from './parser/misc/domain-list';
export { FilterListParser } from './parser/filterlist';
export { HintCommentRuleParser } from './parser/comment/hint-rule';
export { HintParser } from './parser/comment/hint';
export { LogicalExpressionParser } from './parser/misc/logical-expression';
export { MetadataCommentRuleParser } from './parser/comment/metadata';
export { ModifierListParser } from './parser/misc/modifier-list';
export { ModifierParser } from './parser/misc/modifier';
export { NetworkRuleParser } from './parser/network';
export { ParameterListParser } from './parser/misc/parameter-list';
export { PreProcessorCommentRuleParser } from './parser/comment/preprocessor';

// Validator
export { ModifierValidator } from './validator';

// Converter
export { HtmlRuleConverter } from './converter/html';

// Utils
export {
    ADG_SCRIPTLET_MASK,
    AGLINT_COMMAND_PREFIX,
    CLASSIC_DOMAIN_SEPARATOR,
    DOMAIN_EXCEPTION_MARKER,
    HINT_MARKER,
    IF,
    INCLUDE,
    MODIFIERS_SEPARATOR,
    MODIFIER_ASSIGN_OPERATOR,
    MODIFIER_DOMAIN_SEPARATOR,
    MODIFIER_EXCEPTION_MARKER,
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

// Constants
export { METADATA_HEADERS } from './converter/metadata';
export { EXT_CSS_PSEUDO_CLASSES, EXT_CSS_LEGACY_ATTRIBUTES, FORBIDDEN_CSS_FUNCTIONS } from './converter/css';

// Re-export everything from ECSSTree
export * as ECSSTree from '@adguard/ecss-tree';

// Version
export { version } from './version';
