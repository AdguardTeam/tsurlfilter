import { type AdblockSyntaxType, AdblockSyntax } from '../utils/adblockers';
import { BINARY_SCHEMA_VERSION } from '../utils/binary-schema-version';

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
let syntaxSerializationMap: Map<AdblockSyntaxType, number> | undefined;
export const getSyntaxSerializationMap = () => {
    if (!syntaxSerializationMap) {
        syntaxSerializationMap = new Map([
            [AdblockSyntax.Common, 0],
            [AdblockSyntax.Abp, 1],
            [AdblockSyntax.Adg, 2],
            [AdblockSyntax.Ubo, 3],
        ]);
    }
    return syntaxSerializationMap;
};
