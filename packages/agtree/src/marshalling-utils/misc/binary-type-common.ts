/**
 * Type map for binary serialization.
 *
 * @note Values should be fit into 8 bits.
 */
export const enum BinaryTypeMarshallingMap {
    // Basic types
    Null = 1,
    Undefined,
    Boolean,
    Int,
    Float,
    NotANumber,
    String,

    // AGTree nodes
    FilterListNode,
    EmptyRule,
    InvalidRule,

    CommentRuleNode,
    AgentNode,
    AgentRuleNode,
    HintNode,
    HintRuleNode,
    MetadataCommentRuleNode,
    ConfigCommentRuleNode,
    PreProcessorCommentRuleNode,
    ConfigNode,

    NetworkRuleNode,
    HostRuleNode,

    ElementHidingRule,
    CssInjectionRule,
    ScriptletInjectionRule,
    JsInjectionRule,
    HtmlFilteringRule,

    ScriptletInjectionRuleBodyNode,
    ElementHidingRuleBody,
    CssInjectionRuleBody,
    HtmlFilteringRuleBody,
    JsInjectionRuleBody,

    ValueNode,
    RawNode,
    ModifierNode,
    ModifierListNode,
    ParameterListNode,
    DomainListNode,
    DomainNode,
    MethodListNode,
    MethodNode,
    StealthOptionListNode,
    StealthOptionNode,
    AppListNode,
    AppNode,
    HostnameListNode,

    InvalidRuleErrorNode,

    ExpressionVariableNode,
    ExpressionOperatorNode,
    ExpressionParenthesisNode,
}
