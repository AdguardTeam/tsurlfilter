/**
 * @file Custom Jest matcher to check proper node serialization and deserialization.
 */
import zod from 'zod';

import { getErrorMessage } from '../../src/utils/error';
import { type Node } from '../../src/nodes';
import { type BaseParser } from '../../src/parser/interface';
import { OutputByteBuffer } from '../../src/utils/output-byte-buffer';
import { SimpleStorage } from '../helpers/simple-storage';
import { InputByteBuffer } from '../../src/utils/input-byte-buffer';
import { defaultParserOptions } from '../../src/parser/options';
import { type BaseGenerator } from '../../src/generator/base-generator';
import { type BaseSerializer } from '../../src/serializer/base-serializer';

// Extend Jest's global namespace with the custom matcher
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace jest {
        interface Matchers<R> {
            toBeSerializedAndDeserializedProperly(
                parser: BaseParser,
                generator: BaseGenerator,
                serializer: BaseSerializer
            ): Promise<R>;
        }
    }
}

// We have 2 possible parameters here:
//  1. simply a string - in this case, the original and expected rules are the same
//  2. a tuple, where the first member is the original rule, and the second is the expected one (if they differs)
const paramSchema = zod.union([
    zod.string(),
    zod.tuple([zod.string(), zod.string()]),
]);

type ParamType = zod.infer<typeof paramSchema>;

// Extend Jest's expect() with the custom matcher
expect.extend({
    /**
     * Helper function to check node serialization and deserialization
     *
     * @param received Received parameter from expect()
     * @param parser Parser class to use
     * @param generator Generator class to use
     * @param serializer
     * @returns Jest matcher result
     */
    async toBeSerializedAndDeserializedProperly(
        received: unknown,
        parser: typeof BaseParser,
        generator: typeof BaseGenerator,
        serializer: typeof BaseSerializer,
    ): Promise<jest.CustomMatcherResult> {
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
                parser.deserialize(inputBuffer, deserializedNode);
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
    },
});
