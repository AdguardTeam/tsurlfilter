/**
 * @file AST builder re-exports.
 */

export type { ParserCapacity } from './capacity';
export { ValueAstBuilder as ValueParser } from './misc/value';
export { ModifierAstBuilder as ModifierParser } from './misc/modifier';
export { ModifierListAstBuilder as ModifierListParser } from './misc/modifier-list';
export { DomainListAstBuilder as DomainListParser } from './misc/domain-list';
export { NetworkRuleAstBuilder } from './network/network-rule';
export type { ParseOptions } from './options';
export {
    ElementHidingAstBuilder,
    type ElementHidingParseOptions,
} from './cosmetic/element-hiding';
export { CssInjectionAstBuilder } from './cosmetic/css-injection';
export { JsInjectionAstBuilder } from './cosmetic/js-injection';
export { HtmlFilteringAstBuilder } from './cosmetic/html-filtering';
export {
    ScriptletInjectionAstBuilder,
} from './cosmetic/scriptlet-injection';
export { UboCssInjectionAstBuilder } from './cosmetic/ubo-css-injection';
export {
    SelectorListAstBuilder,
    type SelectorListParseOptions,
} from './cosmetic/selector-list';
export {
    SimpleCommentAstBuilder,
    PreprocessorCommentAstBuilder,
    HintCommentAstBuilder,
    MetadataCommentAstBuilder,
    AgentCommentAstBuilder,
    CommentAstBuilder,
} from './comment';
export { RuleParserPipeline as RuleParser, type AnyParsedRule } from './rule-parser';
export { LogicalExpressionAstBuilder } from './misc/logical-expression';
export { ParameterListAstBuilder } from './misc/parameter-list';
export {
    CssAtRuleAstBuilder,
    CssAtRulePipelineParser,
} from './cosmetic/atrule';
