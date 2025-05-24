import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version.js';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const CssInjectionRuleMarshallingMap = {
    SelectorList: 1,
    DeclarationList: 2,
    MediaQueryList: 3,
    Remove: 4,
    Start: 5,
    End: 6,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type CssInjectionRuleMarshallingMap = typeof CssInjectionRuleMarshallingMap[
    keyof typeof CssInjectionRuleMarshallingMap
];
