/**
 * @file Smaller utility functions that cannot be classified in other files here,
 * but it is not worth creating a separate file for them
 */

import { EMPTY_STRING } from '../common/constants';

/**
 * Converts Uint8Array to base64.
 *
 * @param uint8Array Uint8Array to convert.
 *
 * @returns Base64 string.
 */
export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = EMPTY_STRING;
    uint8Array.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Converts base64 to Uint8Array.
 *
 * @param base64 Base64 string to convert.
 *
 * @returns Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const binary = Buffer.from(base64, 'base64').toString('binary');
    const len = binary.length;
    const uint8Array = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
        uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array;
}
