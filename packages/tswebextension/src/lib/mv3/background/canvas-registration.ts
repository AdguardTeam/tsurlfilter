/* eslint-disable class-methods-use-this -- Browser adapters implement a common instance dependency contract. */
import { CanvasProtectionCode } from '../../common/canvas-protection/code';
import {
    CanvasAvailabilityStatus,
    CanvasOperationStatus,
    CanvasRegistrationOperation,
} from '../../common/canvas-protection/constants';
import {
    type Available,
    type CanvasBootstrapSnapshot,
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
            return { status: CanvasAvailabilityStatus.Available, value: scripts.length > 0 };
        } catch (error) {
            return {
                status: CanvasAvailabilityStatus.Unavailable,
                reason: `Chromium userScripts access unavailable: ${String(error)}. `
                + 'Enable Allow User Scripts for this extension (Developer mode before Chrome 138).',
            };
        }
    }

    /**
     * Generates the engine for the page world, where user scripts run.
     *
     * @param snapshot Browser-acknowledged seed and prepared policy.
     *
     * @returns Page-world code.
     */
    public createCode(snapshot: CanvasBootstrapSnapshot): string {
        // Chromium names a user script by its extension URL in stack traces, so the script is renamed.
        return `${CanvasProtectionCode.create(snapshot)}\n//# sourceURL=<anonymous>`;
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
        const operations: RegistrationOperationOutcome[] = [];
        let existing: chrome.userScripts.RegisteredUserScript[];
        try {
            // Only decides between register and update, so a successful check is not reported.
            existing = await chrome.userScripts.getScripts({ ids: [CANVAS_REGISTRATION_ID] });
        } catch (error) {
            operations.push({
                operation: CanvasRegistrationOperation.Check,
                status: CanvasOperationStatus.Failed,
                reason: String(error),
            });
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
        const operation = existing.length > 0
            ? CanvasRegistrationOperation.Update
            : CanvasRegistrationOperation.Register;
        try {
            if (operation === CanvasRegistrationOperation.Update) {
                await chrome.userScripts.update([script]);
            } else {
                await chrome.userScripts.register([script]);
            }
            operations.push({ operation, status: CanvasOperationStatus.Succeeded });
        } catch (error) {
            operations.push({ operation, status: CanvasOperationStatus.Failed, reason: String(error) });
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
            return [{ operation: CanvasRegistrationOperation.Unregister, status: CanvasOperationStatus.Succeeded }];
        } catch (error) {
            throw new CanvasRegistrationOperationError('Chromium canvas removal failed', [
                {
                    operation: CanvasRegistrationOperation.Unregister,
                    status: CanvasOperationStatus.Failed,
                    reason: String(error),
                },
            ]);
        }
    }
}
