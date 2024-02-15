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

    // benchmark serialization
    const ITERS = 20;
    const times: number[] = [];

    for (let i = 0; i < ITERS; i += 1) {
        const outBuffer = new OutputByteBuffer();
        const start = performance.now();
        FilterListParser.serialize(node, outBuffer);
        times.push(performance.now() - start);
    }

    console.log('Average serialization time (ms):', times.reduce((a, b) => a + b, 0) / ITERS);

    // benchmark deserialization
    const outBuffer = new OutputByteBuffer();
    FilterListParser.serialize(node, outBuffer);
    const storage = new SimpleStorage();
    await outBuffer.writeChunksToStorage(storage, 'test');

    const deserializationTimes: number[] = [];
    for (let i = 0; i < ITERS; i += 1) {
        const inBuffer = await InputByteBuffer.createFromStorage(storage, 'test');
        const newNode = {} as FilterList;
        const start = performance.now();
        FilterListParser.deserialize(inBuffer, newNode);
        deserializationTimes.push(performance.now() - start);
    }

    console.log('Average deserialization time (ms):', deserializationTimes.reduce((a, b) => a + b, 0) / ITERS);
})());
