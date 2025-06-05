import { describe, it, expect } from 'vitest';

import { Mutex } from '../../../../src/lib/mv3/utils/mutex';
import { TimeoutError } from '../../../../src/lib/mv3/errors/timeout-error';

describe('Mutex', () => {
    it('should acquire lock immediately when unlocked', async () => {
        const mutex = new Mutex();
        await expect(mutex.lock(1000)).resolves.toBeUndefined();
        expect(mutex.isLocked()).toBe(true);
    });

    it('should throw TimeoutError if lock times out', async () => {
        const mutex = new Mutex();
        await mutex.lock(1000); // lock initially

        await expect(mutex.lock(10)).rejects.toThrow(TimeoutError);
        expect(mutex.isLocked()).toBe(true);
    });

    it('should allow second lock after first is unlocked', async () => {
        const mutex = new Mutex();
        await mutex.lock(1000);
        const lockPromise = mutex.lock(1000);

        // Delay to allow lock to queue
        setTimeout(() => mutex.unlock(), 10);

        await expect(lockPromise).resolves.toBeUndefined();
        expect(mutex.isLocked()).toBe(true);
    });

    it('should unlock and call next resolver if any', async () => {
        const mutex = new Mutex();
        await mutex.lock(1000);
        const lock2 = mutex.lock(1000);

        setTimeout(() => mutex.unlock(), 10);

        await expect(lock2).resolves.toBeUndefined();
        expect(mutex.isLocked()).toBe(true);
    });

    it('should unlock completely when no waiters', async () => {
        const mutex = new Mutex();
        await mutex.lock(1000);
        mutex.unlock();

        expect(mutex.isLocked()).toBe(false);
    });

    it('should throw error if unlocking when already unlocked', () => {
        const mutex = new Mutex();
        expect(() => mutex.unlock()).toThrow('Cannot unlock an unlocked mutex');
    });

    it('should resolve waitUntilUnlocked when unlocked', async () => {
        const mutex = new Mutex();
        await mutex.lock(1000);

        const waitPromise = mutex.waitUntilUnlocked();

        setTimeout(() => mutex.unlock(), 10);

        await expect(waitPromise).resolves.toBeUndefined();
    });

    it('should immediately resolve waitUntilUnlocked if already unlocked', async () => {
        const mutex = new Mutex();
        await expect(mutex.waitUntilUnlocked()).resolves.toBeUndefined();
    });
});
