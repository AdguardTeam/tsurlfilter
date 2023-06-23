/**
 * @file Helper file for CSSTree to provide better compatibility with TypeScript.
 * @see {@link https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/62536}
 */

/**
 * CSSTree node types.
 *
 * @see {@link https://github.com/csstree/csstree/blob/master/docs/ast.md#node-types}
 */
export const enum CssTreeNodeType {
    AnPlusB = 'AnPlusB',
    Atrule = 'Atrule',
    AtrulePrelude = 'AtrulePrelude',
    AttributeSelector = 'AttributeSelector',
    Block = 'Block',
    Brackets = 'Brackets',
    CDC = 'CDC',
    CDO = 'CDO',
    ClassSelector = 'ClassSelector',
    Combinator = 'Combinator',
    Comment = 'Comment',
    Declaration = 'Declaration',
    DeclarationList = 'DeclarationList',
    Dimension = 'Dimension',
    Function = 'Function',
    Hash = 'Hash',
    Identifier = 'Identifier',
    IdSelector = 'IdSelector',
    MediaFeature = 'MediaFeature',
    MediaQuery = 'MediaQuery',
    MediaQueryList = 'MediaQueryList',
    NestingSelector = 'NestingSelector',
    Nth = 'Nth',
    Number = 'Number',
    Operator = 'Operator',
    Parentheses = 'Parentheses',
    Percentage = 'Percentage',
    PseudoClassSelector = 'PseudoClassSelector',
    PseudoElementSelector = 'PseudoElementSelector',
    Ratio = 'Ratio',
    Raw = 'Raw',
    Rule = 'Rule',
    Selector = 'Selector',
    SelectorList = 'SelectorList',
    String = 'String',
    StyleSheet = 'StyleSheet',
    TypeSelector = 'TypeSelector',
    UnicodeRange = 'UnicodeRange',
    Url = 'Url',
    Value = 'Value',
    WhiteSpace = 'WhiteSpace',
}

/**
 * Parser context for CSSTree.
 *
 * @see {@link https://github.com/csstree/csstree/blob/master/docs/parsing.md#context}
 */
export const enum CssTreeParserContext {
    /**
     * Regular stylesheet, should be suitable in most cases (default)
     */
    stylesheet = 'stylesheet',

    /**
     * at-rule (e.g. `@media screen`, `print { ... }`)
     */
    atrule = 'atrule',

    /**
     * at-rule prelude (screen, print for example above)
     */
    atrulePrelude = 'atrulePrelude',

    /**
     * used to parse comma separated media query list
     */
    mediaQueryList = 'mediaQueryList',

    /**
     * used to parse media query
     */
    mediaQuery = 'mediaQuery',

    /**
     * rule (e.g. `.foo`, `.bar:hover { color: red; border: 1px solid black; }`)
     */
    rule = 'rule',

    /**
     * selector group (`.foo`, `.bar:hover` for rule example)
     */
    selectorList = 'selectorList',

    /**
     * selector (`.foo` or `.bar:hover` for rule example)
     */
    selector = 'selector',

    /**
     * block with curly braces ({ color: red; border: 1px solid black; } for rule example)
     */
    block = 'block',

    /**
     * block content w/o curly braces (`color: red; border: 1px solid black;` for rule example),
     * useful for parsing HTML style attribute value
     */
    declarationList = 'declarationList',

    /**
     * declaration (`color: red` or `border: 1px solid black` for rule example)
     */
    declaration = 'declaration',

    /**
     * declaration value (`red` or `1px solid black` for rule example)
     */
    value = 'value',
}
