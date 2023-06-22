/**
 * @file AGTree entry point
 */

// Parser
export { RuleParser } from './parser/rule';
export {
    AnyOperator,
    AnyExpressionNode,
    AnyRule,
    AnyCommentRule,
    AnyCosmeticRule,
    CommentMarker,
    RuleCategory,
    CommentRuleType,
    CosmeticRuleType,
    CosmeticRuleSeparator,
    Node,
    LocationRange,
    Location,
    Value,
    Parameter,
    ParameterList,
    ExpressionVariableNode,
    ExpressionOperatorNode,
    ExpressionParenthesisNode,
    FilterList,
    RuleBase,
    EmptyRule,
    CommentBase,
    CommentRule,
    MetadataCommentRule,
    ConfigCommentRule,
    PreProcessorCommentRule,
    Agent,
    AgentCommentRule,
    Hint,
    HintCommentRule,
    Modifier,
    ModifierList,
    DomainListSeparator,
    DomainList,
    Domain,
    CssInjectionRuleBody,
    ElementHidingRuleBody,
    ScriptletInjectionRuleBody,
    HtmlFilteringRuleBody,
    CosmeticRule,
    ElementHidingRule,
    CssInjectionRule,
    ScriptletInjectionRule,
    HtmlFilteringRule,
    JsInjectionRule,
    NetworkRule,
} from './parser/common';
export { AgentCommentRuleParser } from './parser/comment/agent-rule';
export { AgentParser } from './parser/comment/agent';
export { HintParser } from './parser/comment/hint';
export { HintCommentRuleParser } from './parser/comment/hint-rule';
export { MetadataCommentRuleParser } from './parser/comment/metadata';
export { PreProcessorCommentRuleParser } from './parser/comment/preprocessor';
export { ConfigCommentRuleParser } from './parser/comment/inline-config';
export { CommentRuleParser } from './parser/comment';
export { NetworkRuleParser } from './parser/network';
export { CosmeticRuleParser } from './parser/cosmetic';
export { LogicalExpressionParser } from './parser/misc/logical-expression';
export { DomainListParser } from './parser/misc/domain-list';
export { ModifierListParser } from './parser/misc/modifier-list';
export { ModifierParser } from './parser/misc/modifier';
export { ParameterListParser } from './parser/misc/parameter-list';
export { AdblockSyntaxError } from './parser/errors/adblock-syntax-error';
export { FilterListParser } from './parser/filterlist';

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
export { CosmeticRuleSeparatorFinderResult, CosmeticRuleSeparatorUtils } from './utils/cosmetic-rule-separator';
export { CssTree } from './utils/csstree';
export { CssTreeNodeType, CssTreeParserContext } from './utils/csstree-constants';
export { DomainUtils } from './utils/domain';
export { VariableTable, LogicalExpressionUtils } from './utils/logical-expression';
export { shiftLoc, locRange } from './utils/location';

// Constants
export { METADATA_HEADERS } from './converter/metadata';
export { EXT_CSS_PSEUDO_CLASSES, EXT_CSS_LEGACY_ATTRIBUTES, FORBIDDEN_CSS_FUNCTIONS } from './converter/css';

// Re-export everything from ECSSTree
export * as ECSSTree from '@adguard/ecss-tree';

// Version
export { version } from './version';
