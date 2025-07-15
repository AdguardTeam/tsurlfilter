/* eslint-disable max-classes-per-file */

import { TimeoutError } from '../errors/timeout-error';

/**
 * A mutual exclusion (mutex) primitive for coordinating asynchronous access to a critical section.
 *
 * Only one lock may be held at a time. Others attempting to acquire the lock will either:
 * - Wait in a queue until the lock is released, or
 * - Fail with a TimeoutError if not acquired within a given timeout.
 *
 * This class is useful in asynchronous environments (e.g. browser or Node.js)
 * where race conditions or critical sections need to be protected.
 */
export class Mutex {
    /**
     * Indicates whether the mutex is currently locked.
     */
    private locked = false;

    /**
     * Queue of resolvers waiting to acquire the mutex.
     */
    private waitingResolvers: (() => void)[] = [];

    /**
     * Attempts to acquire the mutex lock within the specified timeout.
     *
     * If the mutex is free, acquires it immediately.
     * Otherwise, waits until the mutex is available or the timeout expires.
     * If the timeout expires before the lock is granted, a {@link TimeoutError} is thrown.
     *
     * @param timeoutMs The maximum time to wait (in milliseconds) to acquire the lock.
     *
     * @throws {TimeoutError} If the lock is not acquired within the specified time.
     */
    public async lock(timeoutMs: number): Promise<void> {
        if (!this.locked) {
            this.locked = true;
            return;
        }

        let resolver: () => void;
        let timeoutId: ReturnType<typeof setTimeout>;

        const promise = new Promise<void>((resolve) => {
            resolver = (): void => {
                clearTimeout(timeoutId);
                resolve();
            };
            this.waitingResolvers.push(resolver);
        });

        const timeoutPromise = new Promise<void>((_, reject) => {
            timeoutId = setTimeout(() => {
                const index = this.waitingResolvers.indexOf(resolver!);
                if (index !== -1) {
                    this.waitingResolvers.splice(index, 1);
                }
                reject(new TimeoutError());
            }, timeoutMs);
        });

        await Promise.race([promise, timeoutPromise]);
    }

    /**
     * Releases the mutex and grants the lock to the next waiter in the queue, if any.
     *
     * If no one is waiting, the mutex becomes unlocked.
     *
     * @throws {Error} If the mutex is already unlocked.
     */
    public unlock(): void {
        if (!this.locked) {
            throw new Error('Cannot unlock an unlocked mutex');
        }

        const next = this.waitingResolvers.shift();

        if (next) {
            next();
        } else {
            this.locked = false;
        }
    }

    /**
     * Returns whether the mutex is currently locked.
     *
     * @returns `true` if the mutex is locked; `false` otherwise.
     */
    public isLocked(): boolean {
        return this.locked;
    }

    /**
     * Returns a promise that resolves once the mutex is unlocked.
     *
     * If the mutex is already unlocked, the promise resolves immediately.
     * Otherwise, it waits until the lock is released.
     *
     * @returns A promise that resolves when the mutex becomes available.
     */
    public async waitUntilUnlocked(): Promise<void> {
        if (!this.locked) {
            return;
        }

        await new Promise<void>((resolve) => {
            this.waitingResolvers.push(resolve);
        });
    }
}
