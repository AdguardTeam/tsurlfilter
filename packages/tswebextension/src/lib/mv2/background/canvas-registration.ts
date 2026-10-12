/* eslint-disable no-await-in-loop -- Registration retirement is acknowledged in browser operation order. */
import browser from 'webextension-polyfill';

import { CanvasProtectionCode } from '../../common/canvas-protection/code';
import {
    CanvasAvailabilityStatus,
    CanvasOperationStatus,
    CanvasPolicyBrowser,
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

import { appContext } from './app-context';
import { buildScriptInserter, InjectionGuard } from './injection-helper';

/**
 * Owns Firefox dynamic registration handles for a persistent background lifetime.
 */
export class FirefoxCanvasRegistration implements CanvasRegistrationAdapter {
    /**
     * The first Firefox version that runs dynamically registered content scripts in the page world.
     */
    private static readonly MAIN_WORLD_VERSION = 128;

    /**
     * Handles remain owned after partial replacement so cleanup can retry them.
     */
    private readonly registrations = new Set<browser.ContentScripts.RegisteredContentScript>();

    /**
     * Whether registered scripts run in the page world, known after the first availability check.
     * Firefox before 128 ignores `world: 'MAIN'` and runs them in the content script sandbox,
     * where they do not reach page code. There the script inserts the engine as a page script.
     * TODO: remove when Firefox before 128 is no longer supported.
     */
    private mainWorld = true;

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
        const { version } = await browser.runtime.getBrowserInfo();
        this.mainWorld = Number.parseInt(version, 10) >= FirefoxCanvasRegistration.MAIN_WORLD_VERSION;
        return { status: CanvasAvailabilityStatus.Available, value: this.registrations.size > 0 };
    }

    /**
     * Generates the engine for the page world, or before Firefox 128 a content script that inserts it.
     *
     * @param snapshot Browser-acknowledged seed and prepared policy.
     *
     * @returns Code to register.
     */
    public createCode(snapshot: CanvasBootstrapSnapshot): string {
        return this.mainWorld
            ? CanvasProtectionCode.create(snapshot)
            : buildScriptInserter(
                CanvasProtectionCode.createPageScriptExpression(snapshot),
                appContext.startTimeMs,
                InjectionGuard.CanvasProtection,
            );
    }

    /**
     * Creates replacement delivery before retiring handles from the prior code.
     *
     * @param code Code from {@link FirefoxCanvasRegistration.createCode}.
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
                ...(this.mainWorld ? { world: 'MAIN' as const } : {}),
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
        await this.retire(previous, operations);
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
        await this.retire([...this.registrations], operations);
        if (operations.some((operation) => operation.status === CanvasOperationStatus.Failed)) {
            throw new CanvasRegistrationOperationError('Firefox canvas removal partially failed', operations);
        }
        return operations;
    }

    /**
     * Unregisters handles in order. A handle that fails stays owned, so a later call retries it.
     *
     * @param handles Handles to retire.
     * @param operations Outcomes, appended in execution order.
     */
    private async retire(
        handles: readonly browser.ContentScripts.RegisteredContentScript[],
        operations: RegistrationOperationOutcome[],
    ): Promise<void> {
        for (const handle of handles) {
            try {
                await handle.unregister();
                this.registrations.delete(handle);
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
    }
}
