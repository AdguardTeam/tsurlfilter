/* eslint-disable no-await-in-loop -- Registration retirement is acknowledged in browser operation order. */
import browser from 'webextension-polyfill';

import {
    CanvasAvailabilityStatus,
    CanvasOperationStatus,
    CanvasPolicyBrowser,
    CanvasRegistrationOperation,
} from '../../common/canvas-protection/constants';
import {
    type Available,
    type ProtectionPolicyArtifact,
    type RegistrationOperationOutcome,
} from '../../common/canvas-protection/contracts';
import {
    type CanvasRegistrationAdapter,
    CanvasRegistrationOperationError,
} from '../../common/canvas-protection/registration';

/**
 * Owns Firefox dynamic registration handles for a persistent background lifetime.
 */
export class FirefoxCanvasRegistration implements CanvasRegistrationAdapter {
    /**
     * Handles remain owned after partial replacement so cleanup can retry them.
     */
    private readonly registrations = new Set<browser.ContentScripts.RegisteredContentScript>();

    /**
     * Checks that the selected dynamic registration dependency is present.
     *
     * @returns Live owned registration presence or the missing dependency.
     */
    public async checkAvailability(): Promise<Available<boolean>> {
        if (typeof browser.contentScripts?.register !== 'function') {
            return {
                status: CanvasAvailabilityStatus.Unavailable,
                reason: 'Firefox contentScripts.register is unavailable',
            };
        }
        return { status: CanvasAvailabilityStatus.Available, value: this.registrations.size > 0 };
    }

    /**
     * Creates replacement delivery before retiring handles from the prior code.
     *
     * @param code Self-contained MAIN-world code with the prepared snapshot.
     * @param policy Trusted prepared native selectors.
     *
     * @returns Actual registration and retirement outcomes.
     *
     * @throws When registration or retirement fails, including partial replacement.
     */
    public async install(
        code: string,
        policy: ProtectionPolicyArtifact,
    ): Promise<readonly RegistrationOperationOutcome[]> {
        if (policy.browser !== CanvasPolicyBrowser.FirefoxMv2) {
            throw new CanvasRegistrationOperationError('Firefox canvas policy browser mismatch', []);
        }
        const previous = [...this.registrations];
        const operations: RegistrationOperationOutcome[] = [];
        try {
            const registration = await browser.contentScripts.register({
                js: [{ code }],
                world: 'MAIN',
                runAt: 'document_start',
                allFrames: true,
                matches: [...policy.selectors.matches],
                ...(policy.selectors.excludeMatches.length > 0
                    ? { excludeMatches: [...policy.selectors.excludeMatches] } : {}),
            });
            this.registrations.add(registration);
            operations.push({
                operation: CanvasRegistrationOperation.Register,
                status: CanvasOperationStatus.Succeeded,
            });
        } catch (error) {
            operations.push({
                operation: CanvasRegistrationOperation.Register,
                status: CanvasOperationStatus.Failed,
                reason: String(error),
            });
            throw new CanvasRegistrationOperationError('Firefox canvas registration failed', operations);
        }
        for (const old of previous) {
            try {
                await old.unregister();
                this.registrations.delete(old);
                operations.push({
                    operation: CanvasRegistrationOperation.Unregister,
                    status: CanvasOperationStatus.Succeeded,
                });
            } catch (error) {
                operations.push({
                    operation: CanvasRegistrationOperation.Unregister,
                    status: CanvasOperationStatus.Failed,
                    reason: String(error),
                });
            }
        }
        if (operations.some((operation) => operation.status === CanvasOperationStatus.Failed)) {
            throw new CanvasRegistrationOperationError('Firefox canvas replacement partially failed', operations);
        }
        return operations;
    }

    /**
     * Retires every owned handle and preserves failed handles for a later retry.
     *
     * @returns Actual retirement outcomes for owned handles.
     *
     * @throws When any registration cannot be removed.
     */
    public async remove(): Promise<readonly RegistrationOperationOutcome[]> {
        const operations: RegistrationOperationOutcome[] = [];
        for (const registration of this.registrations) {
            try {
                await registration.unregister();
                this.registrations.delete(registration);
                operations.push({
                    operation: CanvasRegistrationOperation.Unregister,
                    status: CanvasOperationStatus.Succeeded,
                });
            } catch (error) {
                operations.push({
                    operation: CanvasRegistrationOperation.Unregister,
                    status: CanvasOperationStatus.Failed,
                    reason: String(error),
                });
            }
        }
        if (operations.some((operation) => operation.status === CanvasOperationStatus.Failed)) {
            throw new CanvasRegistrationOperationError('Firefox canvas removal partially failed', operations);
        }
        return operations;
    }
}
