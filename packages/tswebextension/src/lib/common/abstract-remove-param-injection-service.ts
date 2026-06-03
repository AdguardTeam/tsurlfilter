import { type MatchingResult, type NetworkRule, NetworkRuleOption } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID } from './constants';
import { FilteringEventType, type FilteringLogInterface } from './filtering-log';
import { type MatchQuery } from './interfaces';
import { ContentType } from './request-type';
import { nanoid } from './utils/nanoid';
import {
    filterEffectiveRemoveParamRules,
    getRemoveParamDescriptors,
    type RemoveParamDescriptor,
    type RemoveParamDescriptorsResult,
} from './utils/remove-param-rules';
import { getRuleTexts, type RuleTextProvider } from './utils/rule-text-provider';
import { getDomain } from './utils/url';

/**
 * Status values for the {@link ResolveDescriptorsResult} discriminated union.
 */
const enum ResolveDescriptorsStatus {
    /**
     * URL is invalid or tab context is missing; no action should be taken.
     */
    Abort = 'abort',
    /**
     * URL is valid but no rules match; in-page descriptors should be cleared.
     */
    Clear = 'clear',
    /**
     * Rules were found and descriptors are ready for injection or update.
     */
    Match = 'match',
}

/**
 * Discriminated union representing the outcome of descriptor resolution.
 */
type ResolveDescriptorsResult =
    | { status: ResolveDescriptorsStatus.Abort }
    | { status: ResolveDescriptorsStatus.Clear }
    | { status: ResolveDescriptorsStatus.Match; data: RemoveParamDescriptorsResult };

/**
 * Engine API subset required by the remove-param injection service.
 */
export interface RemoveParamEngineApi extends RuleTextProvider {
    /**
     * Matches a request against the engine's filter rules.
     *
     * @param matchQuery The match query.
     *
     * @returns Matching result or null.
     */
    matchRequest(matchQuery: MatchQuery): MatchingResult | null;
}

/**
 * Tab context subset required by the remove-param injection service.
 */
export interface RemoveParamTabContext {
    /**
     * Tab information including the URL.
     */
    info: { url?: string };

    /**
     * Main frame rule from tab context (may be null).
     */
    mainFrameRule: NetworkRule | null;
}

/**
 * Abstract base class for the $removeparam injection service, encapsulating
 * logic shared between the MV2 and MV3 implementations.
 *
 * Subclasses provide platform-specific script injection, event listener
 * registration, and dependency access.
 */
export abstract class AbstractRemoveParamInjectionService {
    /**
     * Tracks tabs that have an active $removeparam injection, mapping
     * tabId to the nonce and secret used for that injection. Used to send
     * descriptor updates without full re-injection on SPA navigations.
     */
    protected removeParamInjections = new Map<number, { nonce: string; secret: string }>();

    /**
     * Constructs the abstract remove param injection service.
     *
     * @param tabsApi Tabs API for accessing tab context.
     * @param tabsApi.getTabContext Returns the tab context for a given tab ID.
     * @param engineApi Engine API for matching requests.
     * @param filteringLog Filtering log for publishing events.
     */
    constructor(
        private readonly tabsApi: { getTabContext(id: number): RemoveParamTabContext | undefined },
        private readonly engineApi: RemoveParamEngineApi,
        private readonly filteringLog: FilteringLogInterface,
    ) {}

    /**
     * Executes the initial $removeparam script injection into the main world.
     *
     * @param tabId Tab identifier.
     * @param frameId Frame identifier.
     * @param descriptors Descriptors to inject.
     * @param nonce Random nonce used as the window property name.
     * @param secret Secret token for updater authentication.
     */
    protected abstract executeInjection(
        tabId: number,
        frameId: number,
        descriptors: RemoveParamDescriptor[],
        nonce: string,
        secret: string,
    ): void;

    /**
     * Sends a lightweight descriptor update to an already-injected tab.
     *
     * @param tabId Tab identifier.
     * @param frameId Frame identifier.
     * @param secret Secret token for updater authentication.
     * @param descriptors Updated descriptors.
     * @param nonce The nonce (window property name) of the existing injection.
     */
    protected abstract executeUpdate(
        tabId: number,
        frameId: number,
        secret: string,
        descriptors: RemoveParamDescriptor[],
        nonce: string,
    ): void;

    /**
     * Registers platform-specific browser event listeners.
     */
    protected abstract registerListeners(): void;

    /**
     * Unregisters platform-specific browser event listeners.
     */
    protected abstract unregisterListeners(): void;

    /**
     * Registers browser event listeners for $removeparam injection tracking.
     */
    public start(): void {
        this.registerListeners();
    }

    /**
     * Removes browser event listeners and clears injection tracking state.
     */
    public stop(): void {
        this.unregisterListeners();
        this.removeParamInjections.clear();
    }

    /**
     * Invalidates any existing $removeparam injection tracking for a given tab.
     * Called when a new navigation replaces the page context.
     *
     * @param tabId The tab ID to invalidate.
     */
    public invalidateTab(tabId: number): void {
        this.removeParamInjections.delete(tabId);
    }

    /**
     * Injects $removeparam History API patches into the main world if matching
     * rules exist for the frame's document URL.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param url Document URL of the committed frame.
     */
    public injectRemoveParam(tabId: number, frameId: number, url: string): void {
        if (frameId !== MAIN_FRAME_ID) {
            return;
        }

        const result = this.resolveDescriptors(tabId, url);
        if (result.status !== ResolveDescriptorsStatus.Match) {
            return;
        }

        const nonce = crypto.randomUUID();
        const secret = crypto.randomUUID();

        this.removeParamInjections.set(tabId, { nonce, secret });

        this.executeInjection(
            tabId,
            frameId,
            result.data.descriptors,
            nonce,
            secret,
        );

        this.logEffectiveRules(tabId, url, result.data.rules);
    }

    /**
     * Handles SPA navigation via History API. If the tab already has an
     * active injection, sends a lightweight descriptor update; otherwise
     * performs a full injection.
     *
     * @param tabId Tab identifier.
     * @param frameId Frame identifier.
     * @param url Current URL after the navigation.
     */
    protected onHistoryStateUpdated(tabId: number, frameId: number, url: string): void {
        if (frameId !== MAIN_FRAME_ID) {
            return;
        }

        const existing = this.removeParamInjections.get(tabId);

        if (existing) {
            this.sendDescriptorUpdate(tabId, frameId, url, existing);
        } else {
            this.injectRemoveParam(tabId, frameId, url);
        }
    }

    /**
     * Cleans up $removeparam injection tracking when a tab is closed.
     *
     * @param tabId The id of the closed tab.
     */
    protected onTabRemoved(tabId: number): void {
        this.removeParamInjections.delete(tabId);
    }

    /**
     * Sends updated $removeparam descriptors to an already-injected tab,
     * avoiding full script re-injection.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param url Current URL after the History API navigation.
     * @param injection The nonce and secret of the existing injection.
     * @param injection.nonce The injection nonce.
     * @param injection.secret The secret token.
     */
    private sendDescriptorUpdate(
        tabId: number,
        frameId: number,
        url: string,
        injection: { nonce: string; secret: string },
    ): void {
        const result = this.resolveDescriptors(tabId, url);
        if (result.status === ResolveDescriptorsStatus.Abort) {
            return;
        }

        const descriptors = result.status === ResolveDescriptorsStatus.Match ? result.data.descriptors : [];

        this.executeUpdate(
            tabId,
            frameId,
            injection.secret,
            descriptors,
            injection.nonce,
        );

        if (result.status === ResolveDescriptorsStatus.Match) {
            this.logEffectiveRules(tabId, url, result.data.rules);
        }
    }

    /**
     * Validates the URL, resolves tab context, and computes $removeparam
     * descriptors.
     *
     * @param tabId Tab identifier.
     * @param url URL to resolve descriptors for.
     *
     * @returns A {@link ResolveDescriptorsResult} discriminated union:
     * `abort` when the URL/tab is invalid, `clear` when no rules match,
     * or `match` with the resolved descriptors.
     */
    private resolveDescriptors(
        tabId: number,
        url: string,
    ): ResolveDescriptorsResult {
        if (!url || !url.startsWith('http')) {
            return { status: ResolveDescriptorsStatus.Abort };
        }

        const tabContext = this.tabsApi.getTabContext(tabId);
        if (!tabContext || !tabContext.info.url) {
            return { status: ResolveDescriptorsStatus.Abort };
        }

        const result = getRemoveParamDescriptors({
            requestUrl: url,
            frameUrl: tabContext.info.url,
            frameRule: tabContext.mainFrameRule,
            engineApi: this.engineApi,
        });

        return result
            ? { status: ResolveDescriptorsStatus.Match, data: result }
            : { status: ResolveDescriptorsStatus.Clear };
    }

    /**
     * Filters rules to those that actually modify the URL and logs them.
     *
     * @param tabId Tab identifier.
     * @param url Request URL.
     * @param rules Rules returned by descriptor resolution.
     */
    private logEffectiveRules(
        tabId: number,
        url: string,
        rules: NetworkRule[],
    ): void {
        const effectiveRules = filterEffectiveRemoveParamRules(url, rules);
        if (effectiveRules.length > 0) {
            this.logAppliedRules(tabId, url, effectiveRules);
        }
    }

    /**
     * Publishes filtering log events for each applied $removeparam rule.
     *
     * @param tabId Tab identifier.
     * @param url Request URL that matched the rules.
     * @param rules Network rules that matched.
     */
    private logAppliedRules(tabId: number, url: string, rules: NetworkRule[]): void {
        for (const rule of rules) {
            const { appliedRuleText, originalRuleText } = getRuleTexts(rule, this.engineApi);

            this.filteringLog.publishEvent({
                type: FilteringEventType.RemoveParam,
                data: {
                    removeParam: true,
                    eventId: nanoid(),
                    tabId,
                    requestUrl: url,
                    frameUrl: url,
                    frameDomain: getDomain(url) || '',
                    requestType: ContentType.Document,
                    filterId: rule.getFilterListId(),
                    ruleIndex: rule.getIndex(),
                    appliedRuleText,
                    originalRuleText,
                    timestamp: Date.now(),
                    isAllowlist: rule.isAllowlist(),
                    isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                    isDocumentLevel: false,
                    isCsp: false,
                    isCookie: false,
                    advancedModifier: rule.getAdvancedModifierValue(),
                },
            });
        }
    }
}
