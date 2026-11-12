import { CanvasProtectionCode } from '../../common/canvas-protection/code';
import {
    CanvasAvailabilityStatus,
    CanvasOperationStatus,
    CanvasRegistrationOperation,
} from '../../common/canvas-protection/constants';
import {
    type Available,
    type CanvasBootstrapSnapshot,
    type DocumentPolicyInput,
    type ProtectionPolicyArtifact,
    type RegistrationOperationOutcome,
} from '../../common/canvas-protection/contracts';
import { deriveSiteSeed, formatKey } from '../../common/canvas-protection/noise';
import { resolveProtectedSite } from '../../common/canvas-protection/policy';
import {
    type CanvasRegistrationAdapter,
    CanvasRegistrationOperationError,
} from '../../common/canvas-protection/registration';
import { logger } from '../../common/utils/logger';
import { CanvasDeliveryGuard } from '../common/canvas-delivery';

import { appContext } from './app-context';
import { buildScriptInserter, InjectionGuard } from './injection-helper';
import { TabsApi } from './tabs/tabs-api';
import { MatchPatterns } from './utils/match-patterns';

/**
 * Script injected into matching documents.
 */
interface CanvasDelivery {
    readonly script: string;
    readonly snapshot: CanvasBootstrapSnapshot;
    readonly matches: RegExp;
    readonly excludeMatches: RegExp;
}

/**
 * Delivers canvas protection in Chromium MV2, which cannot register page-world scripts.
 * The content script fetches the page script synchronously from the background page
 * (`ChromiumMv2CanvasDeliveryChannel`) before page scripts run. Documents that did
 * not get it, e.g. frames that forbid synchronous requests, get the code injected with
 * `tabs.executeScript` when they commit, and it inserts itself as a page script.
 *
 * TODO: remove when Chromium MV2 is no longer supported.
 */
export class ChromiumMv2CanvasInjection implements CanvasRegistrationAdapter {
    /**
     * Current delivery, kept for the background lifetime like a registration.
     */
    private delivery: CanvasDelivery | undefined;

    /**
     * Snapshot of the last generated code, taken by the next installation.
     * The registration calls {@link ChromiumMv2CanvasInjection.createCode} before every
     * {@link ChromiumMv2CanvasInjection.install} in the same serialized flow. `createCode` may
     * also run without an installation when the code hash is unchanged, and a failed
     * installation leaves nothing stale, because the field is cleared at its start.
     */
    private pendingSnapshot: CanvasBootstrapSnapshot | undefined;

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
     * Generates a content script that inserts the engine as a page script, unless the document
     * already got the page script from the content script.
     *
     * The flag name is fixed, because the content script cannot know the app start time.
     * It is compared with `true`, because a page element with that `id` is a named property
     * of `window`. The page cannot set the flag in the isolated world, and a forged flag would
     * only skip delivery in that page's own document.
     *
     * @param snapshot Browser-acknowledged seed and prepared policy.
     *
     * @returns Code to inject.
     */
    public createCode(snapshot: CanvasBootstrapSnapshot): string {
        this.pendingSnapshot = snapshot;
        const inserter = buildScriptInserter(
            CanvasProtectionCode.createPageScriptExpression(snapshot),
            appContext.startTimeMs,
            InjectionGuard.CanvasProtection,
        );
        const flag = `window.${CanvasDeliveryGuard.Delivered}`;
        return `if(${flag}!==true){${flag}=true;${inserter};}`;
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
        const snapshot = this.pendingSnapshot!;
        this.pendingSnapshot = undefined;
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
            snapshot,
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
     * Builds the page script for a document, as the content script world would build it.
     *
     * @param input The document URL and the URL of its top document.
     *
     * @returns The page script, or `undefined` when nothing is delivered or the document
     * is not protected.
     */
    public getPageScript(input: DocumentPolicyInput): string | undefined {
        const { delivery } = this;
        if (delivery === undefined
            || !MatchPatterns.test(delivery.matches, input.url)
            || MatchPatterns.test(delivery.excludeMatches, input.url)) {
            return undefined;
        }
        const { session, policy } = delivery.snapshot;
        const site = resolveProtectedSite(policy, input);
        if (site === undefined) {
            return undefined;
        }
        return CanvasProtectionCode.createSeededPageScript(formatKey(deriveSiteSeed(session, site), 16));
    }

    /**
     * Injects the script into a document whose URL the selectors match, when it commits.
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
