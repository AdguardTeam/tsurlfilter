/**
 * @file Smaller utility functions that cannot be classified in other files here,
 * but it is not worth creating a separate file for them.
 */

import { EMPTY_STRING, TAB } from '../common/constants';

/**
 * A flag indicating whether the code is running in a browser.
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Converts Uint8Array to base64.
 *
 * @param uint8Array Uint8Array to convert.
 *
 * @returns Base64 string.
 */
export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
    const binary = Array.from(uint8Array, (byte) => String.fromCharCode(byte)).join(EMPTY_STRING);
    return isBrowser ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Converts base64 to Uint8Array.
 *
 * @param base64 Base64 string to convert.
 *
 * @returns Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const binary = isBrowser ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const uint8Array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array;
}

/**
 * Helper function to serialize data to JSON and optionally prettify it.
 * Its just helps to keep the code clean and readable.
 *
 * @param data Data to serialize.
 * @param pretty If `true`, the JSON will be prettified with tabs.
 *
 * @returns Serialized JSON.
 */
export function serializeJson(data: unknown, pretty = false): string {
    return JSON.stringify(data, null, pretty ? TAB : undefined);
}
