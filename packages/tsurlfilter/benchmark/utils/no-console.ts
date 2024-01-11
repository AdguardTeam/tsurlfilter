/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file No console wrapper
 */

/**
 * A set of console methods that are disabled while executing a function.
 */
const consoleMethodList = new Set<string>([
    'debug',
    'error',
    'info',
    'log',
    'trace',
    'warn',
]);

/**
 * A simple helper function that wraps a function to disable console methods while executing the function.
 *
 * @param fn Function to wrap
 * @returns Wrapped function
 */
export const noConsoleWrapper = <U extends (...args: any[]) => any>(fn: U) => {
    return (...args: Parameters<U>): ReturnType<U> => {
        const originals: Partial<Console> = {};

        for (const key of Object.keys(global.console)) {
            if (consoleMethodList.has(key)) {
                originals[key] = global.console[key];
                global.console[key] = () => {};
            }
        }

        try {
            return fn(...args);
        } finally {
            for (const key of Object.keys(originals)) {
                global.console[key] = originals[key];
            }
        }
    };
};
