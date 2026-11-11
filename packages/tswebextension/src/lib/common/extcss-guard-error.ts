import { type ExtCssApplyResult } from './extcss-protocol';

/**
 * A deterministic ExtendedCss engine guard failure.
 *
 * The injected apply function reports this failure when the prebuilt
 * `extcss-inject.js` asset did not install its engine, or when the installed
 * engine comes from another package version. Both cases are a permanent
 * misconfiguration: another attempt cannot make the engine appear or change
 * its version, so the background reports the failure instead of retrying it.
 */
export class ExtCssGuardError extends Error {
    /**
     * Guard code reported by the injected apply function.
     */
    public readonly code: ExtCssApplyResult['error'];

    /**
     * Constructs a new ExtCssGuardError.
     *
     * @param result Guard failure returned by the injected apply function.
     */
    constructor(result: ExtCssApplyResult) {
        super(result.message);
        this.name = 'ExtCssGuardError';
        this.code = result.error;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, ExtCssGuardError.prototype);
    }
}
