/**
 * @file Typed-array growth helper.
 *
 * Picks `ArrayBuffer.prototype.transfer` (ES2024, Node ≥ 22, V8 ≥ 11.6) when
 * available, otherwise falls back to `new TArr(len); out.set(old)`. The
 * capability check runs once at module load.
 *
 * Both `growTypedArray` and shrinking (newLength < current.length) are handled
 * by the same helpers — "shrink" is just "grow to a smaller size".
 */

type HasTransfer = ArrayBuffer & { transfer(newByteLength?: number): ArrayBuffer };

const HAS_TRANSFER = typeof (ArrayBuffer.prototype as unknown as HasTransfer).transfer === 'function';

/**
 * Resize a typed array to `newLength` elements, preserving the leading
 * `min(old, new)` elements. Uses `ArrayBuffer.transfer` when available,
 * otherwise falls back to allocate-and-copy.
 *
 * @param arr Source typed array.
 * @param newLength Desired element count of the new array.
 * @param Ctor Constructor for the desired typed-array type.
 *
 * @returns A new typed array of the given length.
 */
function resizeBuffer<T extends Uint8Array | Uint32Array | Int32Array>(
    arr: T,
    newLength: number,
    Ctor: Uint8ArrayConstructor | Uint32ArrayConstructor | Int32ArrayConstructor,
): T {
    if (newLength === arr.length) {
        return arr;
    }
    const bpe = arr.BYTES_PER_ELEMENT;
    if (HAS_TRANSFER && arr.byteOffset === 0 && arr.byteLength === arr.buffer.byteLength) {
        const newBuf = (arr.buffer as HasTransfer).transfer(newLength * bpe);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new (Ctor as any)(newBuf) as T;
    }
    // Fallback: allocate + copy prefix.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = new (Ctor as any)(newLength) as T;
    if (newLength >= arr.length) {
        out.set(arr);
    } else {
        out.set(arr.subarray(0, newLength));
    }
    return out;
}

/**
 * Return a `Uint8Array` of `newLength` whose `[0, min(old, new))` elements
 * equal those of `arr`. Uses `ArrayBuffer.transfer` when available.
 *
 * @param arr Source array.
 * @param newLength Desired element count.
 *
 * @returns A resized `Uint8Array`.
 */
export function growUint8(arr: Uint8Array, newLength: number): Uint8Array {
    return resizeBuffer(arr, newLength, Uint8Array);
}

/**
 * Return a `Uint32Array` of `newLength` whose `[0, min(old, new))` elements
 * equal those of `arr`. Uses `ArrayBuffer.transfer` when available.
 *
 * @param arr Source array.
 * @param newLength Desired element count.
 *
 * @returns A resized `Uint32Array`.
 */
export function growUint32(arr: Uint32Array, newLength: number): Uint32Array {
    return resizeBuffer(arr, newLength, Uint32Array);
}

/**
 * Return an `Int32Array` of `newLength` whose `[0, min(old, new))` elements
 * equal those of `arr`. Uses `ArrayBuffer.transfer` when available.
 *
 * @param arr Source array.
 * @param newLength Desired element count.
 *
 * @returns A resized `Int32Array`.
 */
export function growInt32(arr: Int32Array, newLength: number): Int32Array {
    return resizeBuffer(arr, newLength, Int32Array);
}
