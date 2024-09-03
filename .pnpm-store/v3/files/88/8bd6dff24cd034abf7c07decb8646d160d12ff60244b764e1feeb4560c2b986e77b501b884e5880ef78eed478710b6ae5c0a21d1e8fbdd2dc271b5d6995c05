/**
 * Creates a logger function with the specified "verbose" setting.
 *
 * @param verbose A flag indicating whether to output messages.
 *
 * @returns Function for logging messages.
 */
const createLogger = (verbose: boolean) => {
    return (message: string): void => {
        if (verbose) {
            // eslint-disable-next-line no-console
            console.log(message);
        }
    };
};

export { createLogger };
