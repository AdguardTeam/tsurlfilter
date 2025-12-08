import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const HtmlFilteringBodyMarshallingMap = {
    // Common
    Start: 1,
    End: 2,

    // Body type
    Raw: 3,
    Parsed: 4,

    // `HtmlFilteringRuleBody` node
    SelectorList: 5,

    // `HtmlFilteringRuleSelectorList` node
    SelectorListItem: 6,
    Selectors: 7,

    // `HtmlFilteringRuleSelector` node
    SelectorsItem: 8,
    Parts: 9,
    Combinator: 10,

    // `HtmlFilteringRuleSelectorPart` nodes
    Value: 11,
    Attribute: 12,
    PseudoClass: 13,

    // `HtmlFilteringRuleSelectorAttribute` node
    AttributeName: 14,
    AttributeOperator: 15,
    AttributeValue: 16,
    AttributeFlag: 17,

    // `HtmlFilteringRuleSelectorPseudoClass` node
    PseudoClassName: 18,
    PseudoClassIsFunction: 19,
    PseudoClassArgument: 20,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type HtmlFilteringBodyMarshallingMap = typeof HtmlFilteringBodyMarshallingMap[
    keyof typeof HtmlFilteringBodyMarshallingMap
];
