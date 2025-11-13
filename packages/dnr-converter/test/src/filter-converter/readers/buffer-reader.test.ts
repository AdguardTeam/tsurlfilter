/* eslint-disable no-underscore-dangle */
import { type AnyRule } from '@adguard/agtree';
import { RuleDeserializer } from '@adguard/agtree/deserializer';
import { type InputByteBuffer } from '@adguard/agtree/utils';
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { BufferReader } from '../../../../src/filter-converter/readers/buffer-reader';

/**
 * Extended InputByteBuffer for mocking purposes.
 */
interface MockedInputByteBuffer extends InputByteBuffer {
    /**
     * Internal method for tests to manipulate offset.
     *
     * @param offset The new offset to set.
     */
    _setOffset: (offset: number) => void;
}

/**
 * Creates a mock InputByteBuffer.
 *
 * @param data Data to be contained in the buffer.
 * @param initialOffset Initial offset of the buffer.
 *
 * @returns A mocked InputByteBuffer instance.
 */
const createMockInputByteBuffer = (data: Uint8Array, initialOffset = 0): MockedInputByteBuffer => {
    let offset = initialOffset;

    return {
        get currentOffset() {
            return offset;
        },
        get capacity() {
            return data.length;
        },
        peekUint8: vi.fn(() => data[offset] || 0),
        readUint8: vi.fn(() => {
            const value = data[offset] || 0;
            offset += 1;
            return value;
        }),
        readUint16: vi.fn(() => {
            const value = (data[offset] || 0) | ((data[offset + 1] || 0) << 8);
            offset += 2;
            return value;
        }),
        readUint32: vi.fn(() => {
            const value = (data[offset] || 0)
                         | ((data[offset + 1] || 0) << 8)
                         | ((data[offset + 2] || 0) << 16)
                         | ((data[offset + 3] || 0) << 24);
            offset += 4;
            return value;
        }),
        readString: vi.fn(() => ''),
        readOptimizedUint: vi.fn(() => 0),
        readInt32: vi.fn(() => 0),
        assertUint8: vi.fn(),
        readSchemaVersion: vi.fn(() => 1),
        createCopyWithOffset: vi.fn(),
        getChunks: vi.fn(() => [data]),
        // Internal method for tests to manipulate offset
        _setOffset: (newOffset: number) => {
            offset = newOffset;
        },
    } as unknown as MockedInputByteBuffer;
};

// Mock RuleDeserializer
vi.mock('@adguard/agtree/deserializer', () => ({
    RuleDeserializer: {
        deserialize: vi.fn(),
    },
}));

describe('BufferReader', () => {
    describe('constructor', () => {
        it('should initialize with buffer and set current index', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([1, 2, 3]), 5);
            const reader = new BufferReader(mockBuffer);

            expect(reader.getCurrentPos()).toBe(5);
            expect(reader.getDataLength()).toBe(3);
        });

        it('should initialize with zero offset when buffer has no offset', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([1, 2, 3]));
            const reader = new BufferReader(mockBuffer);

            expect(reader.getCurrentPos()).toBe(0);
            expect(reader.getDataLength()).toBe(3);
        });
    });

    describe('readNext', () => {
        it('should return null when next byte is 0', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([0]));
            const reader = new BufferReader(mockBuffer);

            const result = reader.readNext();

            expect(result).toBeNull();
            expect(mockBuffer.peekUint8).toHaveBeenCalled();
        });

        it('should return null when buffer is empty', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([]));
            const reader = new BufferReader(mockBuffer);

            const result = reader.readNext();

            expect(result).toBeNull();
        });

        it('should deserialize and return rule when valid data exists', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([1, 2, 3]));
            const mockRule: AnyRule = {
                category: 'Network',
                type: 'NetworkRule',
                syntax: 'AdGuard',
            } as AnyRule;

            // Mock the deserializer to populate the rule object
            vi.mocked(RuleDeserializer.deserialize).mockImplementation((buffer, ruleNode) => {
                Object.assign(ruleNode, mockRule);
                (mockBuffer as MockedInputByteBuffer)._setOffset(10); // Simulate advancing the buffer
            });

            const reader = new BufferReader(mockBuffer);
            const result = reader.readNext();

            expect(result).toEqual(mockRule);
            expect(RuleDeserializer.deserialize).toHaveBeenCalledWith(mockBuffer, expect.any(Object));
            expect(reader.getCurrentPos()).toBe(10);
        });

        it('should return null when deserialized rule has no category', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([1, 2, 3]));
            const mockRule = {
                type: 'NetworkRule',
                syntax: 'AdGuard',
                // No category property
            } as AnyRule;

            vi.mocked(RuleDeserializer.deserialize).mockImplementation((buffer, ruleNode) => {
                Object.assign(ruleNode, mockRule);
                (mockBuffer as MockedInputByteBuffer)._setOffset(5);
            });

            const reader = new BufferReader(mockBuffer);
            const result = reader.readNext();

            expect(result).toBeNull();
            expect(reader.getCurrentPos()).toBe(5);
        });

        it('should update current position after each read', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([1, 2, 3, 4, 5]));
            const mockRule: AnyRule = {
                category: 'Network',
                type: 'NetworkRule',
                syntax: 'AdGuard',
            } as AnyRule;

            let callCount = 0;
            vi.mocked(RuleDeserializer.deserialize).mockImplementation((buffer, ruleNode) => {
                Object.assign(ruleNode, mockRule);
                (mockBuffer as MockedInputByteBuffer)._setOffset(2 + (callCount * 2)); // Advance by 2 each time
                callCount += 1;
            });

            const reader = new BufferReader(mockBuffer);

            expect(reader.getCurrentPos()).toBe(0);

            reader.readNext();
            expect(reader.getCurrentPos()).toBe(2);

            reader.readNext();
            expect(reader.getCurrentPos()).toBe(4);
        });
    });

    describe('getCurrentPos', () => {
        it('should return current position', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([1, 2, 3]), 7);
            const reader = new BufferReader(mockBuffer);

            expect(reader.getCurrentPos()).toBe(7);
        });

        it('should return updated position after reading', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([1, 2, 3]));
            const mockRule: AnyRule = {
                category: 'Network',
                type: 'NetworkRule',
                syntax: 'AdGuard',
            } as AnyRule;

            vi.mocked(RuleDeserializer.deserialize).mockImplementation((buffer, ruleNode) => {
                Object.assign(ruleNode, mockRule);
                (mockBuffer as MockedInputByteBuffer)._setOffset(15);
            });

            const reader = new BufferReader(mockBuffer);
            expect(reader.getCurrentPos()).toBe(0);

            reader.readNext();
            expect(reader.getCurrentPos()).toBe(15);
        });
    });

    describe('getDataLength', () => {
        it('should return buffer capacity', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array(10));
            const reader = new BufferReader(mockBuffer);

            expect(reader.getDataLength()).toBe(10);
        });

        it('should return correct length for empty buffer', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array(0));
            const reader = new BufferReader(mockBuffer);

            expect(reader.getDataLength()).toBe(0);
        });

        it('should return correct length regardless of current position', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array(20), 5);
            const reader = new BufferReader(mockBuffer);

            expect(reader.getDataLength()).toBe(20);
        });
    });

    describe('multiple reads', () => {
        it('should handle multiple successful reads', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([1, 2, 3, 4, 5]));
            const mockRule: AnyRule = {
                category: 'Network',
                type: 'NetworkRule',
                syntax: 'AdGuard',
            } as AnyRule;

            let readCount = 0;
            vi.mocked(RuleDeserializer.deserialize).mockImplementation((buffer, ruleNode) => {
                Object.assign(ruleNode, mockRule);
                readCount += 1;
                if (readCount === 1) {
                    (mockBuffer as MockedInputByteBuffer)._setOffset(2);
                } else if (readCount === 2) {
                    (mockBuffer as MockedInputByteBuffer)._setOffset(4);
                }
            });

            // Mock peekUint8 to return non-zero for first two calls, then 0
            let peekCallCount = 0;
            vi.mocked(mockBuffer.peekUint8).mockImplementation(() => {
                peekCallCount += 1;
                return peekCallCount <= 2 ? 1 : 0;
            });

            const reader = new BufferReader(mockBuffer);

            const result1 = reader.readNext();
            expect(result1).toEqual(mockRule);
            expect(reader.getCurrentPos()).toBe(2);

            const result2 = reader.readNext();
            expect(result2).toEqual(mockRule);
            expect(reader.getCurrentPos()).toBe(4);

            const result3 = reader.readNext();
            expect(result3).toBeNull();
        });

        it('should handle mixed successful and failed reads', () => {
            const mockBuffer = createMockInputByteBuffer(new Uint8Array([1, 2, 3]));

            let readCount = 0;
            vi.mocked(RuleDeserializer.deserialize).mockImplementation((buffer, ruleNode) => {
                readCount += 1;
                if (readCount === 1) {
                    // First read: successful rule with category
                    Object.assign(ruleNode, {
                        category: 'Network',
                        type: 'NetworkRule',
                        syntax: 'AdGuard',
                    });
                    (mockBuffer as MockedInputByteBuffer)._setOffset(1);
                } else {
                    // Second read: rule without category
                    Object.assign(ruleNode, {
                        type: 'NetworkRule',
                        syntax: 'AdGuard',
                    });
                    (mockBuffer as MockedInputByteBuffer)._setOffset(2);
                }
            });

            // Mock peekUint8 to return non-zero for first two calls, then 0
            let peekCallCount = 0;
            vi.mocked(mockBuffer.peekUint8).mockImplementation(() => {
                peekCallCount += 1;
                return peekCallCount <= 2 ? 1 : 0;
            });

            const reader = new BufferReader(mockBuffer);

            const result1 = reader.readNext();
            expect(result1).toEqual({
                category: 'Network',
                type: 'NetworkRule',
                syntax: 'AdGuard',
            });
            expect(reader.getCurrentPos()).toBe(1);

            const result2 = reader.readNext();
            expect(result2).toBeNull();
            expect(reader.getCurrentPos()).toBe(2);

            const result3 = reader.readNext();
            expect(result3).toBeNull();
        });
    });
});
