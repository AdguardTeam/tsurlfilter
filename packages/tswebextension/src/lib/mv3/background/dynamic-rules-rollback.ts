import { type DynamicRulesSnapshot } from './dynamic-rules-api';

/**
 * Runs a configuration step and restores the previous dynamic rules if it fails.
 *
 * The step error is rethrown after the rollback, so the caller sees why the
 * configuration failed, while the previous rules keep working. A rollback
 * failure is reported through `onRollbackError` and does not replace the step
 * error.
 *
 * @param snapshot Snapshot of the dynamic rules taken before the step.
 * @param step Configuration step to run.
 * @param rollback Restores the snapshot.
 * @param onRollbackError Handles a rollback failure.
 *
 * @returns Result of the step.
 *
 * @throws The error of the step.
 */
export const withDynamicRulesRollback = async <T>(
    snapshot: DynamicRulesSnapshot,
    step: () => Promise<T>,
    rollback: (snapshot: DynamicRulesSnapshot) => Promise<void>,
    onRollbackError: (error: unknown) => void,
): Promise<T> => {
    let result: T;

    try {
        result = await step();
    } catch (error) {
        try {
            await rollback(snapshot);
        } catch (rollbackError) {
            onRollbackError(rollbackError);
        }

        throw error;
    }

    return result;
};
