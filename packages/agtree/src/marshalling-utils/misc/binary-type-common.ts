/**
 * Type map for binary serialization.
 *
 * @note Values should be fit into 8 bits.
 */
export const BinaryTypeMarshallingMap = {
    // Basic types
    Null: 1,
    Undefined: 2,
    Boolean: 3,
    Int: 4,
    Float: 5,
    NotANumber: 6,
    String: 7,

    // AGTree nodes
    FilterListNode: 8,
    EmptyRule: 9,
    InvalidRule: 10,

    CommentRuleNode: 11,
    AgentNode: 12,
    AgentRuleNode: 13,
    HintNode: 14,
    HintRuleNode: 15,
    MetadataCommentRuleNode: 16,
    ConfigCommentRuleNode: 17,
    PreProcessorCommentRuleNode: 18,
    ConfigNode: 19,

    NetworkRuleNode: 20,
    HostRuleNode: 21,

    ElementHidingRule: 22,
    CssInjectionRule: 23,
    ScriptletInjectionRule: 24,
    JsInjectionRule: 25,
    HtmlFilteringRule: 26,

    ScriptletInjectionRuleBodyNode: 27,
    ElementHidingRuleBody: 28,
    CssInjectionRuleBody: 29,
    HtmlFilteringRuleBody: 30,
    JsInjectionRuleBody: 31,

    ValueNode: 32,
    RawNode: 33,
    ModifierNode: 34,
    ModifierListNode: 35,
    ParameterListNode: 36,
    DomainListNode: 37,
    DomainNode: 38,
    MethodListNode: 39,
    MethodNode: 40,
    StealthOptionListNode: 41,
    StealthOptionNode: 42,
    AppListNode: 43,
    AppNode: 44,
    HostnameListNode: 45,

    InvalidRuleErrorNode: 46,

    ExpressionVariableNode: 47,
    ExpressionOperatorNode: 48,
    ExpressionParenthesisNode: 49,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BinaryTypeMarshallingMap = typeof BinaryTypeMarshallingMap[keyof typeof BinaryTypeMarshallingMap];
