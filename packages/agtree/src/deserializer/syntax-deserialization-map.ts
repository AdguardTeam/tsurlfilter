import { type AdblockSyntax } from '../utils/adblockers.js';
import { getSyntaxSerializationMap } from '../marshalling-utils/syntax-serialization-map.js';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let syntaxDeserializationMap: Map<number, AdblockSyntax> | undefined;
export const getSyntaxDeserializationMap = () => {
    if (!syntaxDeserializationMap) {
        syntaxDeserializationMap = new Map<number, AdblockSyntax>(
            Array.from(getSyntaxSerializationMap(), ([key, value]) => [value, key]),
        );
    }

    return syntaxDeserializationMap;
};
