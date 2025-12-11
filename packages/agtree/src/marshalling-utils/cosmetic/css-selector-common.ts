import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const CssSelectorMarshallingMap = {
    // Common
    Start: 1,
    End: 2,

    // CssSelectorList
    SelectorListHeader: 3, // header
    SelectorListChildren: 4, // children property

    // CssComplexSelector
    ComplexSelectorHeader: 5, // header
    ComplexSelectorChildren: 6, // children property

    // CssComplexSelectorItem
    ComplexSelectorItemHeader: 7, // header
    ComplexSelectorItemCombinator: 8, // combinator property
    ComplexSelectorItemSelector: 9, // selector property

    // CssCompoundSelector
    CompoundSelectorHeader: 10, // header
    CompoundSelectorChildren: 11, // children property

    // CssSimpleSelector
    SimpleSelectorHeader: 12, // header
    SimpleSelectorValue: 13, // value type
    SimpleSelectorAttribute: 14, // attribute type
    SimpleSelectorPseudoClass: 15, // pseudo-class type

    // CssAttributeSelector
    AttributeSelectorHeader: 16, // header
    AttributeSelectorName: 17, // name property
    AttributeSelectorValue: 18, // value property

    // CssAttributeSelectorValue
    AttributeSelectorValueHeader: 19, // header
    AttributeSelectorValueValue: 20, // value property
    AttributeSelectorValueOperator: 21, // operator property
    AttributeSelectorValueIsCaseSensitive: 22, // isCaseSensitive property

    // CssPseudoClassSelector
    PseudoClassSelectorHeader: 23, // header
    PseudoClassSelectorName: 24, // name property
    PseudoClassSelectorArgument: 25, // argument property
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type CssSelectorMarshallingMap = typeof CssSelectorMarshallingMap[
    keyof typeof CssSelectorMarshallingMap
];

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const FREQUENT_CSS_COMBINATORS_SERIALIZATION_MAP = new Map<string, number>([
    [' ', 0],
    ['>', 1],
    ['~', 2],
    ['+', 3],
]);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const FREQUENT_CSS_ATTRIBUTE_OPERATORS_SERIALIZATION_MAP = new Map<string, number>([
    ['=', 0],
    ['~=', 1],
    ['^=', 2],
    ['$=', 3],
    ['*=', 4],
    ['|=', 5],
]);
