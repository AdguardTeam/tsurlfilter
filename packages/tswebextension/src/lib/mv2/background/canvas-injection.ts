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
import { logger } from '../../common/utils/logger';

import { appContext } from './app-context';
import { buildScriptText, InjectionGuard } from './injection-helper';
import { TabsApi } from './tabs/tabs-api';
import { MatchPatterns } from './utils/match-patterns';

/**
 * Script injected into matching documents.
 */
interface CanvasDelivery {
    readonly script: string;
    readonly matches: RegExp;
    readonly excludeMatches: RegExp;
}

/**
 * Delivers canvas protection in Chromium MV2, which cannot register page-world scripts.
 * Like scriptlets, the code is injected with `tabs.executeScript` when a document
 * response starts and again when it commits, and inserts itself as a page script.
 *
 * TODO: remove when Chromium MV2 is no longer supported.
 */
export class ChromiumMv2CanvasInjection implements CanvasRegistrationAdapter {
    /**
     * Current delivery, kept for the background lifetime like a registration.
     */
    private delivery: CanvasDelivery | undefined;

    /**
     * Injection needs no optional browser API.
     *
     * @returns Whether a script is set up for delivery.
     */
    public async checkAvailability(): Promise<Available<boolean>> {
        return { status: CanvasAvailabilityStatus.Available, value: this.delivery !== undefined };
    }

    /**
     * Replaces the delivered script and its selectors.
     *
     * @param code Self-contained page code with the prepared snapshot.
     * @param policy Trusted prepared selectors.
     *
     * @returns The registration outcome.
     *
     * @throws When the policy is not for Chromium MV2 or a selector is invalid.
     */
    public async install(
        code: string,
        policy: ProtectionPolicyArtifact,
    ): Promise<readonly RegistrationOperationOutcome[]> {
        if (policy.browser !== CanvasPolicyBrowser.ChromiumMv2) {
            throw new CanvasRegistrationOperationError('Chromium MV2 canvas policy browser mismatch', []);
        }
        let matches: RegExp;
        let excludeMatches: RegExp;
        try {
            matches = MatchPatterns.compile(policy.selectors.matches);
            excludeMatches = MatchPatterns.compile(policy.selectors.excludeMatches);
        } catch (error) {
            throw new CanvasRegistrationOperationError('Chromium MV2 canvas registration failed', [{
                operation: CanvasRegistrationOperation.Register,
                status: CanvasOperationStatus.Failed,
                reason: String(error),
            }]);
        }
        this.delivery = {
            script: buildScriptText(code, appContext.startTimeMs, InjectionGuard.CanvasProtection),
            matches,
            excludeMatches,
        };
        return [{ operation: CanvasRegistrationOperation.Register, status: CanvasOperationStatus.Succeeded }];
    }

    /**
     * Stops delivery to new documents.
     *
     * @returns The removal outcome, or none when nothing was delivered.
     */
    public async remove(): Promise<readonly RegistrationOperationOutcome[]> {
        if (this.delivery === undefined) {
            return [];
        }
        this.delivery = undefined;
        return [{ operation: CanvasRegistrationOperation.Unregister, status: CanvasOperationStatus.Succeeded }];
    }

    /**
     * Injects the script into a document whose URL the selectors match.
     *
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @param url Document URL.
     */
    public inject(tabId: number, frameId: number, url: string): void {
        const { delivery } = this;
        if (delivery === undefined
            || !MatchPatterns.test(delivery.matches, url)
            || MatchPatterns.test(delivery.excludeMatches, url)) {
            return;
        }
        TabsApi.injectScript(tabId, frameId, delivery.script).catch((error: unknown) => {
            logger.debug('[tsweb.ChromiumMv2CanvasInjection.inject]: failed to inject canvas protection:', error);
        });
    }
}
