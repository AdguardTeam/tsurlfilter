/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
// FIXME: TEMPORARY FILE, SHOULD BE REMOVED
// Usage: npx tsx serializer.ts

import { inspect } from 'util';

import { ModifierListParser } from '../parser/misc/modifier-list';
import { OutputByteBuffer } from '../utils/output-byte-buffer';
import { SimpleStorage } from '../../test/helpers/simple-storage';
import { type ModifierList } from '../parser/common';
import { InputByteBuffer } from '../utils/input-byte-buffer';

const TEST_STR = '~third-party,domain=example.com|~example.org,script';

((async () => {
    // Parse node from string
    const node = ModifierListParser.parse(TEST_STR, {
        isLocIncluded: false,
    });

    // Show the parsed node
    console.log(inspect(node, false, null, true));

    // Create output buffer and serialize the node
    const outBuffer = new OutputByteBuffer();
    ModifierListParser.serialize(node, outBuffer);

    // Show the sizes (in bytes) of the original string and the serialized binary data
    console.log('Original size:', new Blob([TEST_STR]).size);
    console.log('Binary serialized size:', (outBuffer as any).offset);

    // Write the output buffer data to the storage (simulating the storage in the browser environment)
    const storage = new SimpleStorage();
    await outBuffer.writeChunksToStorage(storage, 'test');

    // Create input buffer from the storage (simulating the storage in the browser environment)
    const inBuffer = await InputByteBuffer.createFromStorage(storage, 'test');

    // Deserialize the node from the input buffer
    const newNode = {} as ModifierList;
    ModifierListParser.deserialize(inBuffer, newNode);

    // Show the deserialized node
    console.log(inspect(newNode, false, null, true));

    // Generate the string from the deserialized node
    console.log(ModifierListParser.generate(newNode));
})());
