import * as valibotModule from 'valibot';
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { extractMessageFromValiError, strictObjectByType } from '../../../src/utils/valibot';

vi.mock('valibot', async () => ({
    ...await vi.importActual('valibot'),
    strictObject: vi.fn(),
    getDotPath: vi.fn(() => 'mocked.path'),
}));

describe('Valibot utils', () => {
    describe('strictObjectByType', () => {
        const strictObjectSpy = vi.spyOn(valibotModule, 'strictObject');

        it('should use strictObject directly', () => {
            const schema = { foo: valibotModule.string() };
            strictObjectByType<{ foo: string }>(schema);
            expect(strictObjectSpy).toHaveBeenCalledTimes(1);
            expect(strictObjectSpy).toHaveBeenCalledWith(schema);
        });
    });

    describe('extractMessageFromValiError', () => {
        /**
         * In all tests we use `any` type for the error object to focus on testing
         * the behavior of `extractMessageFromValiError` without needing to construct
         * full Valibot error objects, which can be complex.
         *
         * Also we mocked `getDotPath` valibot utility to return fixed paths for simplicity.
         */

        it('should return error message when issues array is empty', () => {
            const error = {
                message: 'Generic validation error',
                issues: [],
            } as any;

            expect(extractMessageFromValiError(error)).toBe('Generic validation error');
        });

        it('should extract message from single issue without nested issues', () => {
            const error = {
                message: 'Validation failed',
                issues: [{
                    type: 'string',
                    message: 'Expected string',
                }],
            } as any;

            expect(extractMessageFromValiError(error)).toBe(
                '1. Type: "string" | Message: "Expected string" | Path: "mocked.path"',
            );
        });

        it('should extract messages from multiple issues', () => {
            const error = {
                message: 'Validation failed',
                issues: [{
                    type: 'string',
                    message: 'Expected string',
                }, {
                    type: 'number',
                    message: 'Expected number',
                }],
            } as any;

            expect(extractMessageFromValiError(error)).toBe([
                '1. Type: "string" | Message: "Expected string" | Path: "mocked.path"',
                '2. Type: "number" | Message: "Expected number" | Path: "mocked.path"',
            ].join('\n'));
        });

        it('should extract messages from nested issues', () => {
            const error = {
                message: 'Validation failed',
                issues: [{
                    type: 'object',
                    message: 'Invalid object',
                    issues: [{
                        type: 'string',
                        message: 'Expected string',
                    }, {
                        type: 'email',
                        message: 'Invalid email format',
                    }],
                }],
            } as any;

            expect(extractMessageFromValiError(error)).toBe([
                '1. Type: "object" | Message: "Invalid object" | Path: "mocked.path"',
                '1.1. Type: "string" | Message: "Expected string" | Path: "mocked.path"',
                '1.2. Type: "email" | Message: "Invalid email format" | Path: "mocked.path"',
            ].join('\n'));
        });

        it('should handle deeply nested issues with proper numbering', () => {
            const error = {
                message: 'Validation failed',
                issues: [{
                    type: 'object',
                    message: 'Invalid root object',
                    issues: [{
                        type: 'object',
                        message: 'Invalid nested object',
                        issues: [{
                            type: 'string',
                            message: 'Expected string',
                        }],
                    }],
                }],
            } as any;

            expect(extractMessageFromValiError(error)).toBe([
                '1. Type: "object" | Message: "Invalid root object" | Path: "mocked.path"',
                '1.1. Type: "object" | Message: "Invalid nested object" | Path: "mocked.path"',
                '1.1.1. Type: "string" | Message: "Expected string" | Path: "mocked.path"',
            ].join('\n'));
        });

        it('should handle multiple top-level issues with nested sub-issues', () => {
            const error = {
                name: 'ValiError',
                message: 'Validation failed',
                issues: [{
                    type: 'object',
                    message: 'Invalid user object',
                    issues: [{
                        type: 'string',
                        message: 'Expected string',
                    }],
                }, {
                    type: 'object',
                    message: 'Invalid settings object',
                    issues: [{
                        type: 'number',
                        message: 'Expected number',
                    }],
                }],
            } as any;

            expect(extractMessageFromValiError(error)).toBe([
                '1. Type: "object" | Message: "Invalid user object" | Path: "mocked.path"',
                '1.1. Type: "string" | Message: "Expected string" | Path: "mocked.path"',
                '2. Type: "object" | Message: "Invalid settings object" | Path: "mocked.path"',
                '2.1. Type: "number" | Message: "Expected number" | Path: "mocked.path"',
            ].join('\n'));
        });
    });
});
