/* eslint-disable no-plusplus */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
// FIXME: TEMPORARY FILE, SHOULD BE REMOVED
// Usage: npx tsx serializer-bench.ts

import { ModifierListParser } from '../parser/misc/modifier-list';
import { OutputByteBuffer } from '../utils/output-byte-buffer';
import { SimpleStorage } from '../../test/helpers/simple-storage';
import { type ModifierList } from '../parser/common';
import { InputByteBuffer } from '../utils/input-byte-buffer';

((async () => {
    const ITERS = 100000;

    const TEST_STR = '~third-party,domain=example.com|~example.org,script';

    // Parse node from string
    const node = ModifierListParser.parse(TEST_STR, {
        isLocIncluded: false,
    });

    // Create output buffer and serialize the node
    const outBuffer = new OutputByteBuffer();

    const serializeTimes = new Array(ITERS);

    for (let i = 0; i < ITERS; i++) {
        const s = performance.now();
        ModifierListParser.serialize(node, outBuffer);
        serializeTimes[i] = performance.now() - s;
    }

    console.log('Output buffer size in MB:', (outBuffer as any).offset / 1024 / 1024);
    console.log('Output buffer chunks:', (outBuffer as any).byteBuffer.chunks.length);

    const storage = new SimpleStorage();
    await outBuffer.writeChunksToStorage(storage, 'test');

    const inBuffer = await InputByteBuffer.createFromStorage(storage, 'test');

    const deserializeTimes = new Array(ITERS);
    for (let i = 0; i < ITERS; i++) {
        const s = performance.now();
        const newNode = {} as ModifierList;
        ModifierListParser.deserialize(inBuffer, newNode);
        deserializeTimes[i] = performance.now() - s;
    }

    console.log(`serialize average time: ${serializeTimes.reduce((acc, val) => acc + val, 0) / ITERS}ms`);
    console.log(`deserialize average time: ${deserializeTimes.reduce((acc, val) => acc + val, 0) / ITERS}ms`);

    console.log('overall serialize time:', serializeTimes.reduce((acc, val) => acc + val, 0), 'ms');
    console.log('overall deserialize time:', deserializeTimes.reduce((acc, val) => acc + val, 0), 'ms');
})());
