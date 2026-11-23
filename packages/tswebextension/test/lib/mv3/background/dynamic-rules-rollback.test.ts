import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type DynamicRulesSnapshot } from '../../../../src/lib/mv3/background/dynamic-rules-api';
import { withDynamicRulesRollback } from '../../../../src/lib/mv3/background/dynamic-rules-rollback';

/**
 * Creates an empty dynamic rules snapshot.
 *
 * @returns Snapshot of the previous dynamic rules.
 */
const createSnapshot = (): DynamicRulesSnapshot => ({
    rules: [],
    sourceMap: new Map(),
    disabledStaticRuleIds: new Map(),
});

describe('withDynamicRulesRollback', () => {
    it('returns the result of a successful step without rolling back', async () => {
        const rollback = vi.fn().mockResolvedValue(undefined);

        const result = await withDynamicRulesRollback(
            createSnapshot(),
            async () => 'done',
            rollback,
            vi.fn(),
        );

        expect(result).toBe('done');
        expect(rollback).not.toHaveBeenCalled();
    });

    it('restores the snapshot and rethrows the step error', async () => {
        const snapshot = createSnapshot();
        const rollback = vi.fn().mockResolvedValue(undefined);
        const onRollbackError = vi.fn();
        const stepError = new Error('session update failed');

        await expect(withDynamicRulesRollback(
            snapshot,
            async () => {
                throw stepError;
            },
            rollback,
            onRollbackError,
        )).rejects.toBe(stepError);

        expect(rollback).toHaveBeenCalledWith(snapshot);
        expect(onRollbackError).not.toHaveBeenCalled();
    });

    it('reports a rollback failure without replacing the step error', async () => {
        const rollbackError = new Error('rollback failed');
        const onRollbackError = vi.fn();
        const stepError = new Error('session update failed');

        await expect(withDynamicRulesRollback(
            createSnapshot(),
            async () => {
                throw stepError;
            },
            async () => {
                throw rollbackError;
            },
            onRollbackError,
        )).rejects.toBe(stepError);

        expect(onRollbackError).toHaveBeenCalledWith(rollbackError);
    });
});
