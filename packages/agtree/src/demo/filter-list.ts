/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
// FIXME: TEMPORARY FILE, SHOULD BE REMOVED
// Usage: npx tsx serializer.ts

import { readFileSync } from 'fs';

import { OutputByteBuffer } from '../utils/output-byte-buffer';
import { SimpleStorage } from '../../test/helpers/simple-storage';
import { type FilterList } from '../parser/common';
import { InputByteBuffer } from '../utils/input-byte-buffer';
import { FilterListParser } from '../parser/filterlist';
import { defaultParserOptions } from '../parser/options';

const FILTER_LIST = 'adg-base.txt';

((async () => {
    const filterListContent = readFileSync(FILTER_LIST, 'utf-8');
    // Parse node from string
    const node = FilterListParser.parse(filterListContent, {
        ...defaultParserOptions,
        tolerant: true,
        isLocIncluded: false,
    });

    if (node === null) {
        throw new Error('Parsing failed');
    }

    // Create output buffer and serialize the node
    const outBuffer = new OutputByteBuffer();
    FilterListParser.serialize(node, outBuffer);

    // Show the sizes (in bytes) of the original string and the serialized binary data
    console.log('Original size in MB:', new Blob([filterListContent]).size / 1024 / 1024);
    console.log('Binary serialized size in MB:', (outBuffer as any).offset / 1024 / 1024);

    // Write the output buffer data to the storage (simulating the storage in the browser environment)
    const storage = new SimpleStorage();
    await outBuffer.writeChunksToStorage(storage, 'test');

    // Create input buffer from the storage (simulating the storage in the browser environment)
    const inBuffer = await InputByteBuffer.createFromStorage(storage, 'test');

    // Deserialize the node from the input buffer
    const newNode = {} as FilterList;
    FilterListParser.deserialize(inBuffer, newNode);

    // // Show the deserialized node
    // console.log(inspect(newNode, false, null, true));

    // Generate the string from the deserialized node
    // console.log(CommentRuleParser.generate(newNode));
})());
