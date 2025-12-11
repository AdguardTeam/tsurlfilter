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
    Start: 1,
    End: 2,
    SelectorList: 3,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type HtmlFilteringBodyMarshallingMap = typeof HtmlFilteringBodyMarshallingMap[
    keyof typeof HtmlFilteringBodyMarshallingMap
];
