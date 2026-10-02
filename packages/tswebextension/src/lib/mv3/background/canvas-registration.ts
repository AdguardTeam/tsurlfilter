/* eslint-disable class-methods-use-this -- Browser adapters implement a common instance dependency contract. */
import {
    type Available,
    type ProtectionPolicyArtifact,
    type RegistrationOperationOutcome,
} from '../../common/canvas-protection/contracts';
import {
    type CanvasRegistrationAdapter,
    CanvasRegistrationOperationError,
} from '../../common/canvas-protection/registration';

const CANVAS_REGISTRATION_ID = 'adguard-canvas-protection';

/**
 * Owns the Chromium userScripts dependency for early MAIN-world delivery.
 */
export class ChromiumCanvasRegistration implements CanvasRegistrationAdapter {
    /**
     * Checks API access through an awaited call, including access revocation.
     *
     * @returns Own registration presence or an actionable prerequisite reason.
     */
    public async checkAvailability(): Promise<Available<boolean>> {
        try {
            const scripts = await chrome.userScripts.getScripts({ ids: [CANVAS_REGISTRATION_ID] });
            return { status: 'available', value: scripts.length > 0 };
        } catch (error) {
            return {
                status: 'unavailable',
                reason: `Chromium userScripts access unavailable: ${String(error)}. `
                + 'Enable Allow User Scripts for this extension (Developer mode before Chrome 138).',
            };
        }
    }

    /**
     * Installs or updates the stable registration with exact selectors.
     *
     * @param code Self-contained code carrying the prepared snapshot.
     * @param policy Trusted prepared native URL selectors.
     *
     * @returns Actual operation outcomes after fulfilled registration.
     *
     * @throws When API access, creation or replacement fails.
     */
    public async install(
        code: string,
        policy: ProtectionPolicyArtifact,
    ): Promise<readonly RegistrationOperationOutcome[]> {
        if (policy.browser !== 'chromium-mv3') {
            throw new CanvasRegistrationOperationError('Chromium canvas policy browser mismatch', []);
        }
        const operations: RegistrationOperationOutcome[] = [];
        let existing: chrome.userScripts.RegisteredUserScript[];
        try {
            existing = await chrome.userScripts.getScripts({ ids: [CANVAS_REGISTRATION_ID] });
            operations.push({ operation: 'check', status: 'succeeded' });
        } catch (error) {
            operations.push({ operation: 'check', status: 'failed', reason: String(error) });
            throw new CanvasRegistrationOperationError('Chromium canvas registration check failed', operations);
        }
        const script: chrome.userScripts.RegisteredUserScript = {
            id: CANVAS_REGISTRATION_ID,
            js: [{ code }],
            world: 'MAIN',
            runAt: 'document_start',
            allFrames: true,
            matches: [...policy.selectors.matches],
            excludeMatches: [...policy.selectors.excludeMatches],
        };
        const operation = existing.length > 0 ? 'update' : 'register';
        try {
            if (operation === 'update') {
                await chrome.userScripts.update([script]);
            } else {
                await chrome.userScripts.register([script]);
            }
            operations.push({ operation, status: 'succeeded' });
        } catch (error) {
            operations.push({ operation, status: 'failed', reason: String(error) });
            throw new CanvasRegistrationOperationError(`Chromium canvas ${operation} failed`, operations);
        }
        return operations;
    }

    /**
     * Removes future delivery after the browser acknowledges unregistration.
     *
     * @returns The actual fulfilled removal.
     *
     * @throws When the browser cannot remove the stored registration.
     */
    public async remove(): Promise<readonly RegistrationOperationOutcome[]> {
        try {
            await chrome.userScripts.unregister({ ids: [CANVAS_REGISTRATION_ID] });
            return [{ operation: 'unregister', status: 'succeeded' }];
        } catch (error) {
            throw new CanvasRegistrationOperationError('Chromium canvas removal failed', [
                { operation: 'unregister', status: 'failed', reason: String(error) },
            ]);
        }
    }
}
