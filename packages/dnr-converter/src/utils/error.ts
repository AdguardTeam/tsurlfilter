import { getErrorMessage as loggerGetErrorMessage } from '@adguard/logger';
import { ValiError } from 'valibot';

import { extractMessageFromValiError } from './valibot';

/**
 * Converts error object to error with message.
 * This method might be helpful to handle thrown errors.
 * If error is instance of {@link ValiError},
 * it will prettify the error messages via {@link extractMessageFromValiError}.
 *
 * @param error Error object.
 *
 * @returns Message of the error.
 */
export function getErrorMessage(error: unknown): string {
    // Special case: pretty print Valibot errors
    if (error instanceof ValiError) {
        return extractMessageFromValiError(error);
    }

    return loggerGetErrorMessage(error);
}
