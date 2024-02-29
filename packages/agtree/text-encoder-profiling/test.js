import { readFileSync } from 'fs';
import * as AGTree from '../dist/src/index.js';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;

const ITERATIONS = 100;

const filterContent = readFileSync(path.join(__dirname, './agbase.txt'), 'utf8');

// generate a 10000 length alphanumeric string
// const testString = Array.from({ length: 100000 }, () => Math.random().toString(36)[2]).join('');
const testString = filterContent;

const te = new TextEncoder();
const td = new TextDecoder();

// measure native text encoder
const times1 = [];
for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    te.encode(testString);
    times1.push(performance.now() - start);
}

console.log('Native TextEncoder', times1.reduce((a, b) => a + b) / times1.length + 'ms');

// measure native text decoder
const encodedNative = te.encode(testString);

const times2 = [];
for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    td.decode(encodedNative);
    times2.push(performance.now() - start);
}

console.log('Native TextDecoder', times2.reduce((a, b) => a + b) / times2.length + 'ms');

console.profile('agtree-te-td');

// measure agtree text encoder
const times3 = [];

for (let i = 0; i < ITERATIONS; i++) {
    const outBuffer = new AGTree.OutputByteBuffer();
    const start = performance.now();
    outBuffer.writeString(testString);
    times3.push(performance.now() - start);
}

console.log('AGTree TextEncoder', times3.reduce((a, b) => a + b) / times3.length + 'ms');

// measure agtree text decoder
const outBuffer = new AGTree.OutputByteBuffer();
outBuffer.writeString(testString);

const times4 = [];
for (let i = 0; i < ITERATIONS; i++) {
    const inBuffer = new AGTree.InputByteBuffer(outBuffer.byteBuffer.chunks);
    const start = performance.now();
    inBuffer.readString();
    times4.push(performance.now() - start);
}

console.log('AGTree TextDecoder', times4.reduce((a, b) => a + b) / times4.length + 'ms');

console.profileEnd('agtree-te-td');
