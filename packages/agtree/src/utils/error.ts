type ErrorWithMessage = {
    message: string;
};

/**
 * Checks if error has message.
 *
 * @param error Error object.
 *
 * @returns If param is error.
 */
function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
        typeof error === 'object'
        && error !== null
        && 'message' in error
        && typeof (error as Record<string, unknown>).message === 'string'
    );
}

/**
 * Converts error to the error with message.
 *
 * @param maybeError Possible error.
 *
 * @returns Error with message.
 */
function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
    if (isErrorWithMessage(maybeError)) {
        return maybeError;
    }

    try {
        return new Error(JSON.stringify(maybeError));
    } catch {
        // fallback in case there's an error stringifying the maybeError
        // like with circular references for example.
        return new Error(String(maybeError));
    }
}

/**
 * Converts error object to error with message. This method might be helpful to handle thrown errors.
 *
 * @param error Error object.
 *
 * @returns Message of the error.
 */
export function getErrorMessage(error: unknown): string {
    return toErrorWithMessage(error).message;
}

/**
 * Normalises an unknown thrown value to an `Error` instance.
 *
 * If the value is already an `Error` it is returned as-is;
 * otherwise it is wrapped with `new Error(String(value))`.
 *
 * @param error The value caught in a `catch` block.
 *
 * @returns An `Error` instance.
 */
export function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
