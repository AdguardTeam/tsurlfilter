/* eslint-disable no-plusplus */
/* eslint-disable no-console */
// FIXME: temporary file
// use: npx tsx encoder-bench.ts
import { ByteBuffer } from './byte-buffer';
import { encode } from './text-encoder';

const ITERS = 100;
const BASE_TEST_STRING = 'hello world';
// const BASE_TEST_STRING = 'hello world, ÜПривет, мир, 你好世界';

// generate test strings
const testStrings = new Array(ITERS);
for (let i = 0; i < ITERS; i++) {
    testStrings[i] = `${BASE_TEST_STRING} ${i}`;
}

// benchmark native TextEncoder
const encoder = new TextEncoder();
const preEncode = encoder.encode(`${BASE_TEST_STRING} ${ITERS}`);
const buffer = new Uint8Array(preEncode.length);

let start = performance.now();
const textEncoderTimes = new Array(ITERS);
for (let i = 0; i < ITERS; i++) {
    const s = performance.now();
    encoder.encodeInto(testStrings[i], buffer);
    textEncoderTimes[i] = performance.now() - s;
}
console.log(`TextEncoder overall time: ${performance.now() - start}ms`);
const textEncoderAvg = textEncoderTimes.reduce((acc, val) => acc + val, 0) / ITERS;
console.log(`TextEncoder average time: ${textEncoderAvg}ms`);

// benchmark encode
const encodeTimes = new Array(ITERS);
const byteBuffer = new ByteBuffer();
start = performance.now();
for (let i = 0; i < ITERS; i++) {
    const s = performance.now();
    encode(testStrings[i], byteBuffer);
    encodeTimes[i] = performance.now() - s;
}
console.log(`encode overall time: ${performance.now() - start}ms`);
const encodeAvg = encodeTimes.reduce((acc, val) => acc + val, 0) / ITERS;
console.log(`encode average time: ${encodeAvg}ms`);

console.log('');
console.log(`encode is ${(((textEncoderAvg - encodeAvg) / textEncoderAvg) * 100).toFixed(2)}% slower`);
