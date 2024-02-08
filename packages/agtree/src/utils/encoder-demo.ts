/* eslint-disable no-console */
// FIXME: temporary file
// use: npx tsx encoder-demo.ts
import { ByteBuffer } from './byte-buffer';
import { decode } from './text-decoder';
import { encode } from './text-encoder';

const buffer = new ByteBuffer();
const str = '你好';
const byteOffsetBefore = buffer.byteOffset;
const bytesWritten = encode(buffer, str);
console.log(`Bytes written: ${bytesWritten}`);
// console.log(`Buffer: ${buffer.subarray(byteOffsetBefore, byteOffsetBefore + bytesWritten)}`);
const decodedStr = decode(buffer, byteOffsetBefore, bytesWritten);
console.log(`Decoded string: ${decodedStr}`);
console.log(`Byte offset: ${buffer.byteOffset}`);
