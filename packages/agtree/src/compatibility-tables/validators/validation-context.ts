/**
 * @file Mutable validation context that accumulates issues during validation.
 */

import type { Node } from '../../nodes';

/**
 * Validation issue (error or warning).
 */
export type ValidationIssue = {
    /**
     * Type of issue: error or warning.
     */
    type: 'error' | 'warn';

    /**
     * Message ID for the issue (for i18n and structured error handling).
     */
    messageId: string;

    /**
     * Data to be interpolated into the message.
     */
    data?: Record<string, unknown>;

    /**
     * Start offset of the issue.
     */
    start?: number;

    /**
     * End offset of the issue.
     */
    end?: number;
};

/**
 * Mutable validation context that accumulates issues during validation.
 *
 * Created once per top-level validate() call and passed through all sub-validators.
 * Sub-validators mutate this context by calling addError/addWarning instead of
 * allocating new result objects, which minimizes GC pressure.
 *
 * On the happy path (valid input), no issues array is allocated at all.
 */
export class ValidationContext {
    /**
     * Whether the validated input is valid so far.
     * Set to false on the first error and never reverts.
     */
    public valid = true;

    /**
     * Accumulated issues. Lazily allocated on first issue to avoid
     * an empty array allocation on the happy path.
     */
    public issues: ValidationIssue[] | null = null;

    /**
     * Base offset to apply to all location calculations.
     */
    public readonly baseOffset: number;

    /**
     * Creates a new validation context.
     *
     * @param baseOffset Base offset to apply to all location calculations (default: 0).
     */
    constructor(baseOffset = 0) {
        this.baseOffset = baseOffset;
    }

    /**
     * Adds an error issue.
     *
     * @param messageId Message ID for the error.
     * @param data Optional data to be interpolated into the message.
     * @param start Optional start offset.
     * @param end Optional end offset.
     */
    public addError(messageId: string, data?: Record<string, unknown>, start?: number, end?: number): void {
        this.valid = false;
        (this.issues ??= []).push({
            type: 'error',
            messageId,
            data,
            start,
            end,
        });
    }

    /**
     * Adds a warning issue.
     *
     * @param messageId Message ID for the warning.
     * @param data Optional data to be interpolated into the message.
     * @param start Optional start offset.
     * @param end Optional end offset.
     */
    public addWarning(messageId: string, data?: Record<string, unknown>, start?: number, end?: number): void {
        (this.issues ??= []).push({
            type: 'warn',
            messageId,
            data,
            start,
            end,
        });
    }

    /**
     * Adds an error issue with location derived from a Node.
     *
     * @param messageId Message ID for the error.
     * @param node Node with location info.
     * @param data Optional data to be interpolated into the message.
     */
    public addErrorFromNode(messageId: string, node: Node, data?: Record<string, unknown>): void {
        this.addError(
            messageId,
            data,
            (node.start ?? 0) + this.baseOffset,
            (node.end ?? 0) + this.baseOffset,
        );
    }

    /**
     * Adds a warning issue with location derived from a Node.
     *
     * @param messageId Message ID for the warning.
     * @param node Node with location info.
     * @param data Optional data to be interpolated into the message.
     */
    public addWarningFromNode(messageId: string, node: Node, data?: Record<string, unknown>): void {
        this.addWarning(
            messageId,
            data,
            (node.start ?? 0) + this.baseOffset,
            (node.end ?? 0) + this.baseOffset,
        );
    }
}
