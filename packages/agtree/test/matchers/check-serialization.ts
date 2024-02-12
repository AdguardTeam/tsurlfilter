/**
 * @file Custom Jest matcher to check proper node serialization and deserialization.
 */

import { getErrorMessage } from '../../src/utils/error';
import { type Node } from '../../src/parser/common';
import { type ParserBase } from '../../src/parser/interface';
import { OutputByteBuffer } from '../../src/utils/output-byte-buffer';
import { SimpleStorage } from '../helpers/simple-storage';
import { InputByteBuffer } from '../../src/utils/input-byte-buffer';

// Extend Jest's global namespace with the custom matcher
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace jest {
        interface Matchers<R> {
            toBeSerializedAndDeserializedProperly(parser: ParserBase): Promise<R>;
        }
    }
}

/**
 * Checks if the parameter is a string
 *
 * @param param Parameter to check
 * @returns `true` if the parameter is a string
 */
const isString = (param: unknown): param is string => typeof param === 'string';

// Extend Jest's expect() with the custom matcher
expect.extend({
    /**
     * Helper function to check node serialization and deserialization
     *
     * @param received Received parameter from expect()
     * @param parser Parser class to use
     * @returns Jest matcher result
     */
    async toBeSerializedAndDeserializedProperly(
        received: unknown,
        parser: typeof ParserBase,
    ): Promise<jest.CustomMatcherResult> {
        // Validate the received parameter
        if (!isString(received)) {
            return {
                pass: false,
                message: () => `Expected '${received}' to be a string`,
            };
        }

        // Parse the rule
        let originalNode: Node | null;

        try {
            // Omit location data
            originalNode = parser.parse(received, { isLocIncluded: false }, 0);
        } catch (error: unknown) {
            return {
                pass: false,
                message: () => `Failed to parse '${received}', got error: '${getErrorMessage(error)}'`,
            };
        }

        if (originalNode === null) {
            return {
                pass: false,
                message: () => `Failed to parse '${received}', got null`,
            };
        }

        // Serialize the rule into the output buffer
        const outputBuffer = new OutputByteBuffer();

        try {
            parser.serialize(originalNode, outputBuffer);
        } catch (error: unknown) {
            return {
                pass: false,
                message: () => `Failed to serialize '${received}', got error: '${getErrorMessage(error)}'`,
            };
        }

        // Deserialize the rule from the output buffer
        const storage = new SimpleStorage();
        await outputBuffer.writeChunksToStorage(storage, 'test');
        const inputBuffer = await InputByteBuffer.createFromStorage(storage, 'test');

        const deserializedNode: Node = {} as Node;

        try {
            parser.deserialize(inputBuffer, deserializedNode);
        } catch (error: unknown) {
            return {
                pass: false,
                message: () => `Failed to deserialize '${received}', got error: '${getErrorMessage(error)}'`,
            };
        }

        // Original and deserialized nodes should be equal (but of course they are not the same object)
        expect(deserializedNode).toEqual(originalNode);

        // Generated strings should be equal as well
        expect(parser.generate(originalNode)).toEqual(parser.generate(deserializedNode));

        return {
            pass: true,
            message: () => 'Serialization and deserialization passed',
        };
    },
});
