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
import { logger } from '../../common/utils/logger';

import { appContext } from './app-context';
import { buildScriptInserter, InjectionGuard } from './injection-helper';
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
     * Injection needs no optional browser API. Unlike a registration, a script set up
     * here is acknowledged by no browser: injection into a document can still fail,
     * e.g. when the user limits the extension's site access.
     *
     * @returns Whether a script is set up for delivery.
     */
    public async checkAvailability(): Promise<Available<boolean>> {
        return { status: CanvasAvailabilityStatus.Available, value: this.delivery !== undefined };
    }

    /**
     * Generates a content script that inserts the engine as a page script.
     *
     * @param snapshot Browser-acknowledged seed and prepared policy.
     *
     * @returns Code to inject.
     */
    // eslint-disable-next-line class-methods-use-this -- Implements the adapter contract.
    public createCode(snapshot: CanvasBootstrapSnapshot): string {
        return buildScriptInserter(
            CanvasProtectionCode.createPageScriptExpression(snapshot),
            appContext.startTimeMs,
            InjectionGuard.CanvasProtection,
        );
    }

    /**
     * Replaces the delivered script and its selectors.
     *
     * @param code Code from {@link ChromiumMv2CanvasInjection.createCode}.
     * @param policy Trusted prepared selectors.
     *
     * @returns The registration outcome.
     *
     * @throws When a selector is invalid.
     */
    public async install(
        code: string,
        policy: ProtectionPolicyArtifact,
    ): Promise<readonly RegistrationOperationOutcome[]> {
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
            script: code,
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
