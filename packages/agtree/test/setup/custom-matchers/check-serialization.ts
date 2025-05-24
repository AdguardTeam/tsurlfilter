/**
 * @file Custom Vitest matcher to check proper node serialization and deserialization.
 *
 * @see https://vitest.dev/guide/extending-matchers#extending-matchers
 */
import zod from 'zod';
import { expect } from 'vitest';
import { type AsyncExpectationResult } from '@vitest/expect';

import { getErrorMessage } from '../../../src/utils/error.js';
import { type Node } from '../../../src/nodes/index.js';
import { type BaseParser } from '../../../src/parser/base-parser.js';
import { OutputByteBuffer } from '../../../src/utils/output-byte-buffer.js';
import { SimpleStorage } from '../../helpers/simple-storage.js';
import { InputByteBuffer } from '../../../src/utils/input-byte-buffer.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { type BaseGenerator } from '../../../src/generator/base-generator.js';
import { type BaseSerializer } from '../../../src/serializer/base-serializer.js';
import { type BaseDeserializer } from '../../../src/deserializer/base-deserializer.js';

// We have 2 possible parameters here:
//  1. simply a string - in this case, the original and expected rules are the same
//  2. a tuple, where the first member is the original rule, and the second is the expected one (if they differs)
const paramSchema = zod.union([
    zod.string(),
    zod.tuple([zod.string(), zod.string()]),
]);

type ParamType = zod.infer<typeof paramSchema>;

/**
 * Helper function to check node serialization and deserialization
 *
 * @param received Received parameter from expect()
 * @param parser Parser class to use
 * @param generator Generator class to use
 * @param serializer Serializer class to use
 * @param deserializer Deserializer class to use
 * @returns Vitest matcher result
 */
const toBeSerializedAndDeserializedProperly = async (
    received: unknown,
    parser: typeof BaseParser,
    generator: typeof BaseGenerator,
    serializer: typeof BaseSerializer,
    deserializer: typeof BaseDeserializer,
): AsyncExpectationResult => {
    try {
        // Validate the received parameter
        let param: ParamType;

        try {
            param = paramSchema.parse(received);
        } catch (error: unknown) {
            throw new Error(
                // eslint-disable-next-line max-len
                `Expected '${received}' to be a string or a tuple of strings, but got error '${getErrorMessage(error)}'`,
            );
        }

        let original: string;
        let expected: string;

        if (!Array.isArray(param)) {
            original = param;
            expected = param;
        } else {
            [original, expected] = param;
        }

        const parseNode = (raw: string): Node => {
            let node: Node | null;
            try {
                node = parser.parse(
                    raw,
                    {
                        ...defaultParserOptions,
                        // TODO: add support for raws, if ever needed
                        includeRaws: false,
                    },
                    0,
                );
            } catch (error: unknown) {
                throw new Error(`Failed to parse '${raw}', got error: '${getErrorMessage(error)}'`);
            }

            if (node === null) {
                throw new Error(`Failed to parse '${raw}', got null`);
            }

            return node;
        };

        const originalNode = parseNode(original);
        const expectedNode = original === expected ? originalNode : parseNode(expected);

        // Serialize the rule into the output buffer
        const outputBuffer = new OutputByteBuffer();

        try {
            serializer.serialize(originalNode, outputBuffer);
        } catch (error: unknown) {
            throw new Error(`Failed to serialize '${received}', got error: '${getErrorMessage(error)}')`);
        }

        // Deserialize the rule from the output buffer
        const storage = new SimpleStorage();
        await outputBuffer.writeChunksToStorage(storage, 'test');
        const inputBuffer = await InputByteBuffer.createFromStorage(storage, 'test');

        const deserializedNode: Node = {} as Node;

        try {
            deserializer.deserialize(inputBuffer, deserializedNode);
        } catch (error: unknown) {
            throw new Error(`Failed to deserialize '${received}', got error: '${getErrorMessage(error)}'`);
        }

        // Original and deserialized nodes should be equal (but of course they are not the same object)
        expect(deserializedNode).toEqual(expectedNode);

        // Generated strings should be equal as well
        expect(generator.generate(deserializedNode)).toEqual(generator.generate(expectedNode));

        return {
            pass: true,
            message: () => 'Serialization and deserialization passed',
        };
    } catch (error: unknown) {
        return {
            pass: false,
            message: () => getErrorMessage(error),
        };
    }
};

// Extend Vitest's expect() with the custom matcher
expect.extend({
    toBeSerializedAndDeserializedProperly,
});

export type ToBeSerializedAndDeserializedProperly = typeof toBeSerializedAndDeserializedProperly;
