/**
 * @vitest-environment jsdom
 */

import {
    afterEach,
    describe,
    expect,
    it,
    type MockInstance,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { ExtendedCss } from '@adguard/extended-css';
import { CosmeticResult } from '@adguard/tsurlfilter';

import { CosmeticControllerCommon } from '../../../../src/lib/common/content-script/cosmetic-controller';
import * as SendMessageModule from '../../../../src/lib/common/content-script/send-app-message';
import { type ContentScriptCosmeticData } from '../../../../src/lib/common/cosmetic-api';
import { MessageType } from '../../../../src/lib/common/message-constants';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import {
    CosmeticController as CosmeticControllerMV2,
} from '../../../../src/lib/mv2/content-script/cosmetic-controller';
import {
    CosmeticController as CosmeticControllerMV3,
} from '../../../../src/lib/mv3/content-script/cosmetic-controller';
import { mockMutationObserver, MutationObserverMock } from '../../../helpers/mutation-observer';
import { createCosmeticRule } from '../../../helpers/rule-creator';

vi.mock('../../../../src/lib/common/content-script/send-app-message', () => {
    const module = vi.importActual('../../../../src/lib/common/content-script/send-app-message');
    return module;
});

/**
 * Controllers under test.
 */
const controllers = [
    ['MV2', CosmeticControllerMV2],
    ['MV3', CosmeticControllerMV3],
] as const;

/**
 * Controllers created by the current test.
 *
 * Stopping them prevents an earlier test's counter or collector from
 * observing DOM changes made by the next test.
 */
const createdControllers: CosmeticControllerCommon[] = [];

/**
 * Creates a controller and remembers it for cleanup.
 *
 * @param Controller Controller class under test.
 *
 * @returns Created controller.
 */
const createController = (
    Controller: typeof CosmeticControllerMV2 | typeof CosmeticControllerMV3,
): CosmeticControllerCommon => {
    const controller = new Controller();
    createdControllers.push(controller);
    return controller;
};

afterEach(() => {
    createdControllers.forEach((controller) => {
        const internals = controller as unknown as {
            cssHitsCounter?: { stop: () => void };
            pendingProbesCollector?: { stop: () => void };
        };

        internals.cssHitsCounter?.stop();
        internals.pendingProbesCollector?.stop();
    });
    createdControllers.length = 0;

    // Remove listeners registered by controllers created in this file.
    // eslint-disable-next-line no-underscore-dangle
    (browser.runtime.onMessage as unknown as { _listeners: unknown[] })._listeners = [];
    vi.restoreAllMocks();
});

/**
 * Creates cosmetic result for elemhide rules.
 *
 * @param rules Element hiding rules.
 *
 * @returns Element hiding rules cosmetic result.
 */
const getElemhideCosmeticResult = (rules: string[]): CosmeticResult => {
    const cosmeticResult = new CosmeticResult();
    rules.forEach((rule) => {
        cosmeticResult.elementHiding.append(createCosmeticRule(rule, 0));
    });
    return cosmeticResult;
};

/**
 * Returns cosmetic data based on `rules`.
 *
 * @param rules Element hiding rules.
 * @param areHitsStatsCollected Flag for hits counter.
 *
 * @returns Cosmetic data object.
 */
const getCosmeticData = (rules: string[], areHitsStatsCollected: boolean): ContentScriptCosmeticData => {
    const cosmeticResult = getElemhideCosmeticResult(rules);
    const extCssRules = CosmeticApi.getExtCssRules(
        cosmeticResult,
        {
            areHitsStatsCollected,
        },
    );
    return {
        isAppStarted: true,
        areHitsStatsCollected,
        areNativeHitsStatsCollected: areHitsStatsCollected,
        extCssRules,
        nativeCssSelectors: null,
    };
};
describe.each(controllers)('%s short-lived probes', (_name, CosmeticController) => {
    it('starts collecting probes before the cosmetic data request and reports them', async () => {
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            "@property --adguard-hit { syntax: '*'; inherits: false; initial-value: ''; }",
            "div.loading-bait { display: none !important; --adguard-hit: 'adguard0%3B42' !important; }",
        ].join('\n');
        document.head.appendChild(style);

        try {
            const cosmeticData: ContentScriptCosmeticData = {
                isAppStarted: true,
                areHitsStatsCollected: true,
                areNativeHitsStatsCollected: true,
                extCssRules: [],
                nativeCssSelectors: null,
            };

            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockResolvedValue(cosmeticData);

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            // The collector must observe the DOM before the response is
            // processed, so the observer is already created at this point.
            const collectorObserver = MutationObserverMock.last!;

            const bait = document.createElement('div');
            bait.className = 'loading-bait';
            collectorObserver.trigger([{
                addedNodes: [bait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            // Wait for the cosmetic controller to process the response.
            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            const stats = sendAppMessageSpy.mock.calls
                .map(([message]) => message)
                .filter((message) => message.type === MessageType.SaveCssHitsStats)
                .flatMap((message) => message.payload as Array<{ filterId: number; ruleIndex: number }>);

            expect(stats).toContainEqual(expect.objectContaining({ filterId: 0, ruleIndex: 42 }));
            expect(bait.parentNode).toBeNull();
        } finally {
            style.remove();
            restoreMutationObserver();
        }
    });

    it('keeps loading probes while native markers are being injected', async () => {
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            "@property --adguard-hit { syntax: '*'; inherits: false; initial-value: ''; }",
            "div.pending-native-bait { display: none !important; --adguard-hit: 'adguard0%3B43' !important; }",
        ].join('\n');

        let resolveReapply!: (value: ContentScriptCosmeticData) => void;
        let reapplyStartedResolve!: () => void;

        const reapplyPromise = new Promise<ContentScriptCosmeticData>((resolve) => {
            resolveReapply = resolve;
        });
        const reapplyStarted = new Promise<void>((resolve) => {
            reapplyStartedResolve = resolve;
        });

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockImplementation(async (message) => {
                    const isReapply = message.type === MessageType.GetCosmeticData
                        && (message.payload as { reapplyHits?: boolean }).reapplyHits;

                    if (isReapply) {
                        reapplyStartedResolve();
                        return reapplyPromise;
                    }

                    return {
                        ...getCosmeticData([], true),
                        areNativeHitsStatsCollected: false,
                    };
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            const collectorObserver = MutationObserverMock.last!;
            const bait = document.createElement('div');
            bait.className = 'pending-native-bait';
            collectorObserver.trigger([{
                addedNodes: [bait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            await reapplyStarted;

            // The initial CSS is still being injected. The marker is added
            // before the reapply response resumes the paused counter.
            document.head.appendChild(style);
            resolveReapply(getCosmeticData([], true));

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            const stats = sendAppMessageSpy.mock.calls
                .map(([message]) => message)
                .filter((message) => message.type === MessageType.SaveCssHitsStats)
                .flatMap((message) => message.payload as Array<{ filterId: number; ruleIndex: number }>);

            expect(stats).toContainEqual(expect.objectContaining({ filterId: 0, ruleIndex: 43 }));
        } finally {
            style.remove();
            restoreMutationObserver();
        }
    });

    it('stops the collector when the background does not respond', async () => {
        const restoreMutationObserver = mockMutationObserver();

        try {
            vi.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue(null);

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            const collectorObserver = MutationObserverMock.last!;

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(collectorObserver.isDisconnected).toBe(true);
        } finally {
            restoreMutationObserver();
        }
    });

    it('retries a rejected cosmetic data request', async () => {
        const restoreMutationObserver = mockMutationObserver();
        vi.useFakeTimers();

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockRejectedValueOnce(new Error('background unavailable'))
                .mockResolvedValue(getCosmeticData([], false));

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            const retryTimeout = (CosmeticControllerCommon as unknown as {
                GET_COSMETIC_DATA_RETRY_TIMEOUT_MS: number;
            }).GET_COSMETIC_DATA_RETRY_TIMEOUT_MS;
            await vi.advanceTimersByTimeAsync(retryTimeout);

            expect(sendAppMessageSpy).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
            restoreMutationObserver();
        }
    });

    it('stops the collector when hits stats are not collected', async () => {
        const restoreMutationObserver = mockMutationObserver();

        try {
            vi.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue({
                isAppStarted: true,
                areHitsStatsCollected: false,
                areNativeHitsStatsCollected: false,
                extCssRules: [],
                nativeCssSelectors: null,
            });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            const collectorObserver = MutationObserverMock.last!;

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(collectorObserver.isDisconnected).toBe(true);
        } finally {
            restoreMutationObserver();
        }
    });
});

describe.each(controllers)('%s collect hit stats changes', (_name, CosmeticController) => {
    afterEach(() => {
        // Remove listeners registered by controllers created in this file.
        // eslint-disable-next-line no-underscore-dangle
        (browser.runtime.onMessage as unknown as { _listeners: unknown[] })._listeners = [];
    });

    /**
     * Returns stats with the given filter id from `SaveCssHitsStats` messages.
     *
     * @param sendAppMessageSpy Spy on `sendAppMessage`.
     * @param filterId Filter id to select.
     *
     * @returns Collected stats.
     */
    const getBaitStats = (
        sendAppMessageSpy: MockInstance,
        filterId: number,
    ): Array<{ filterId: number; ruleIndex: number }> => {
        return sendAppMessageSpy.mock.calls
            .map(([message]) => message as { type: MessageType; payload: unknown })
            .filter((message) => message.type === MessageType.SaveCssHitsStats)
            .flatMap((message) => message.payload as Array<{ filterId: number; ruleIndex: number }>)
            .filter((stat) => stat.filterId === filterId);
    };

    /**
     * Triggers a runtime message as the background would.
     *
     * @param message Message to trigger.
     */
    const triggerRuntimeMessage = (message: unknown): void => {
        (browser.runtime.onMessage as unknown as {
            trigger: (value: unknown) => void;
        }).trigger(message);
    };

    it('pauses and resumes the counter on messages', async () => {
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            'div.controller-pause-bait',
            "{ display: none !important; --adguard-hit: 'adguard33%3B33' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockResolvedValue({
                    isAppStarted: true,
                    areHitsStatsCollected: true,
                    areNativeHitsStatsCollected: true,
                    extCssRules: [],
                    nativeCssSelectors: null,
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: false },
            });

            const pausedBait = document.createElement('div');
            pausedBait.className = 'controller-pause-bait';
            MutationObserverMock.last!.trigger([{
                addedNodes: [pausedBait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            expect(getBaitStats(sendAppMessageSpy, 33)).toHaveLength(0);

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            const resumedBait = document.createElement('div');
            resumedBait.className = 'controller-pause-bait';
            MutationObserverMock.last!.trigger([{
                addedNodes: [resumedBait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            expect(getBaitStats(sendAppMessageSpy, 33)).toHaveLength(1);
        } finally {
            style.remove();
            restoreMutationObserver();
        }
    });

    it('applies a message received before the counter is created', async () => {
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            'div.controller-early-bait',
            "{ display: none !important; --adguard-hit: 'adguard34%3B34' !important; }",
            'div.controller-stale-bait',
            "{ display: none !important; --adguard-hit: 'adguard35%3B35' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        const staleBait = document.createElement('div');
        staleBait.className = 'controller-stale-bait';

        let resolveCosmeticData!: (value: ContentScriptCosmeticData) => void;
        const cosmeticDataPromise = new Promise<ContentScriptCosmeticData>((resolve) => {
            resolveCosmeticData = resolve;
        });

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockReturnValue(cosmeticDataPromise);

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            const collectorObserver = MutationObserverMock.last!;

            const earlyBait = document.createElement('div');
            earlyBait.className = 'controller-early-bait';
            collectorObserver.trigger([{
                addedNodes: [earlyBait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: false },
            });

            // The collector must stop even before the counter is created, and
            // its pending probes must not be reported by the counter.
            expect(collectorObserver.isDisconnected).toBe(true);

            // Keep a marked element in the document when the stale response
            // arrives. An active counter would scan and report it.
            document.body.appendChild(staleBait);

            resolveCosmeticData({
                isAppStarted: true,
                areHitsStatsCollected: true,
                areNativeHitsStatsCollected: true,
                extCssRules: [],
                nativeCssSelectors: null,
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(getBaitStats(sendAppMessageSpy, 34)).toHaveLength(0);
            expect(getBaitStats(sendAppMessageSpy, 35)).toHaveLength(0);

            staleBait.remove();

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            const resumedBait = document.createElement('div');
            resumedBait.className = 'controller-early-bait';
            MutationObserverMock.last!.trigger([{
                addedNodes: [resumedBait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            // Only the fresh bait is counted. The early bait was cleared when
            // the collector stopped.
            expect(getBaitStats(sendAppMessageSpy, 34)).toHaveLength(1);
        } finally {
            staleBait.remove();
            style.remove();
            restoreMutationObserver();
        }
    });

    it('re-applies marked data when collection is enabled after cosmetic data was applied', async () => {
        const restoreMutationObserver = mockMutationObserver();

        const markedStyle = document.createElement('style');
        markedStyle.textContent = [
            'div.controller-live-enable-bait',
            "{ display: none !important; --adguard-hit: 'adguard36%3B36' !important; }",
        ].join(' ');

        const bait = document.createElement('div');
        bait.className = 'controller-live-enable-bait';
        document.body.appendChild(bait);

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockImplementation(async (message) => {
                    const isReapply = message.type === MessageType.GetCosmeticData
                        && (message.payload as { reapplyHits?: boolean }).reapplyHits;

                    if (isReapply) {
                        // Simulate the background re-injecting marked native
                        // CSS while the page is already open.
                        document.head.appendChild(markedStyle);

                        return {
                            isAppStarted: true,
                            areHitsStatsCollected: true,
                            areNativeHitsStatsCollected: true,
                            extCssRules: [],
                            nativeCssSelectors: null,
                        };
                    }

                    return {
                        isAppStarted: true,
                        areHitsStatsCollected: false,
                        areNativeHitsStatsCollected: false,
                        extCssRules: [],
                        nativeCssSelectors: null,
                    };
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(sendAppMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: MessageType.GetCosmeticData,
                payload: expect.objectContaining({ reapplyHits: true }),
            }));
            expect(getBaitStats(sendAppMessageSpy, 36)).toHaveLength(1);
        } finally {
            bait.remove();
            markedStyle.remove();
            restoreMutationObserver();
        }
    });

    it('re-applies marked ExtendedCss rules on live enable', async () => {
        const restoreMutationObserver = mockMutationObserver();
        const disposeSpy = vi.spyOn(ExtendedCss.prototype, 'dispose');
        document.body.innerHTML = '<div id="live-ext-bait" class="ad_header">text</div>';

        const rules = ['#?#.ad_header:contains(text)'];

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockImplementation(async (message) => {
                    const isReapply = message.type === MessageType.GetCosmeticData
                        && (message.payload as { reapplyHits?: boolean }).reapplyHits;

                    return getCosmeticData(rules, !!isReapply);
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            // The marked ExtendedCss rule must be applied to the element that
            // was already in the document when collection was enabled.
            expect(getBaitStats(sendAppMessageSpy, 0).length).toBeGreaterThan(0);
            expect(disposeSpy).toHaveBeenCalled();
        } finally {
            document.body.innerHTML = '';
            restoreMutationObserver();
        }
    });

    it('keeps applied ExtendedCss rules when reapply has no rules', async () => {
        const restoreMutationObserver = mockMutationObserver();
        const disposeSpy = vi.spyOn(ExtendedCss.prototype, 'dispose');
        document.body.innerHTML = '<div id="preserved-ext-bait" class="ad_header">text</div>';

        const rules = ['#?#.ad_header:contains(text)'];

        try {
            vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockImplementation(async (message) => {
                    const isReapply = message.type === MessageType.GetCosmeticData
                        && (message.payload as { reapplyHits?: boolean }).reapplyHits;

                    return isReapply
                        ? getCosmeticData([], true)
                        : getCosmeticData(rules, false);
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(disposeSpy).not.toHaveBeenCalled();
            disposeSpy.mockClear();

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(disposeSpy).not.toHaveBeenCalled();
        } finally {
            document.body.innerHTML = '';
            restoreMutationObserver();
        }
    });

    it('applies marked ExtendedCss rules when native CSS injection failed', async () => {
        const restoreMutationObserver = mockMutationObserver();
        document.body.innerHTML = '<div id="native-failed-bait" class="ad_header">text</div>';

        const rules = ['#?#.ad_header:contains(text)'];
        let reapplyRequests = 0;

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockImplementation(async (message) => {
                    const isReapply = message.type === MessageType.GetCosmeticData
                        && (message.payload as { reapplyHits?: boolean }).reapplyHits;

                    if (isReapply) {
                        reapplyRequests += 1;
                        return {
                            ...getCosmeticData(rules, true),
                            areNativeHitsStatsCollected: false,
                        };
                    }

                    return getCosmeticData([], false);
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            // ExtendedCss hits do not depend on the native CSS injection.
            expect(getBaitStats(sendAppMessageSpy, 0).length).toBeGreaterThan(0);
            expect(reapplyRequests).toBe(1);

            // Native markers are still missing, so the next enable retries
            // the marked-data request.
            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: false },
            });
            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(reapplyRequests).toBe(2);
        } finally {
            document.body.innerHTML = '';
            restoreMutationObserver();
        }
    });

    it('requests native markers when only ExtendedCss is marked', async () => {
        const restoreMutationObserver = mockMutationObserver();
        document.body.innerHTML = '<div id="native-marker-missing-bait" class="ad_header">text</div>';

        const rules = ['#?#.ad_header:contains(text)'];
        let reapplyRequests = 0;

        try {
            vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockImplementation(async (message) => {
                    const isReapply = message.type === MessageType.GetCosmeticData
                        && (message.payload as { reapplyHits?: boolean }).reapplyHits;

                    if (isReapply) {
                        reapplyRequests += 1;
                        return getCosmeticData(rules, true);
                    }

                    return {
                        ...getCosmeticData(rules, true),
                        areNativeHitsStatsCollected: false,
                    };
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            // The initial response has marked ExtendedCss but no marked native
            // CSS, so the controller must ask for the native markers too.
            expect(reapplyRequests).toBe(1);
        } finally {
            document.body.innerHTML = '';
            restoreMutationObserver();
        }
    });

    it('keeps ExtendedCss hits when collection is toggled during reapply', async () => {
        const restoreMutationObserver = mockMutationObserver();
        document.body.innerHTML = '';

        const rules = ['#?#.ad_header:contains(text)'];
        let resolveReapply!: (value: ContentScriptCosmeticData) => void;
        let reapplyStartedResolve!: () => void;

        const reapplyPromise = new Promise<ContentScriptCosmeticData>((resolve) => {
            resolveReapply = resolve;
        });
        const reapplyStarted = new Promise<void>((resolve) => {
            reapplyStartedResolve = resolve;
        });

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockImplementation(async (message) => {
                    const isReapply = message.type === MessageType.GetCosmeticData
                        && (message.payload as { reapplyHits?: boolean }).reapplyHits;

                    if (isReapply) {
                        reapplyStartedResolve();
                        return reapplyPromise;
                    }

                    return {
                        ...getCosmeticData(rules, true),
                        areNativeHitsStatsCollected: false,
                    };
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            await reapplyStarted;

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: false },
            });
            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            const bait = document.createElement('div');
            bait.className = 'ad_header';
            bait.textContent = 'text';
            document.body.appendChild(bait);

            resolveReapply({
                ...getCosmeticData(rules, true),
                areNativeHitsStatsCollected: true,
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(getBaitStats(sendAppMessageSpy, 0).length).toBeGreaterThan(0);
        } finally {
            document.body.innerHTML = '';
            restoreMutationObserver();
        }
    });

    it('retries marked data after a failed reapply', async () => {
        const restoreMutationObserver = mockMutationObserver();
        let reapplyRequests = 0;

        try {
            vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockImplementation(async (message) => {
                    const isReapply = message.type === MessageType.GetCosmeticData
                        && (message.payload as { reapplyHits?: boolean }).reapplyHits;

                    if (isReapply) {
                        reapplyRequests += 1;
                        return null;
                    }

                    return {
                        isAppStarted: true,
                        areHitsStatsCollected: false,
                        areNativeHitsStatsCollected: false,
                        extCssRules: [],
                        nativeCssSelectors: null,
                    };
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            // Enable collection before the unmarked cosmetic data response
            // is applied. The controller creates a counter and asks for
            // marked data, but the request fails.
            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(reapplyRequests).toBe(1);

            // The counter still exists over unmarked CSS. Enabling again must
            // request the marked data instead of resuming the counter.
            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(reapplyRequests).toBe(2);
        } finally {
            restoreMutationObserver();
        }
    });

    it('retries an enable dropped while a reapply is in flight', async () => {
        const restoreMutationObserver = mockMutationObserver();
        let reapplyRequests = 0;
        let resolveFirstReapply!: (value: null) => void;
        let firstReapplyStartedResolve!: () => void;
        let secondReapplyStartedResolve!: () => void;

        const firstReapplyStarted = new Promise<void>((resolve) => {
            firstReapplyStartedResolve = resolve;
        });
        const secondReapplyStarted = new Promise<void>((resolve) => {
            secondReapplyStartedResolve = resolve;
        });

        try {
            vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockImplementation((message) => {
                    const isReapply = message.type === MessageType.GetCosmeticData
                        && (message.payload as { reapplyHits?: boolean }).reapplyHits;

                    if (isReapply) {
                        reapplyRequests += 1;

                        if (reapplyRequests === 1) {
                            firstReapplyStartedResolve();
                            return new Promise((resolve) => {
                                resolveFirstReapply = resolve;
                            });
                        }

                        secondReapplyStartedResolve();
                        return Promise.resolve(null);
                    }

                    return Promise.resolve({
                        isAppStarted: true,
                        areHitsStatsCollected: false,
                        areNativeHitsStatsCollected: false,
                        extCssRules: [],
                        nativeCssSelectors: null,
                    });
                });

            const cosmeticController = createController(CosmeticController);
            cosmeticController.init();

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            await firstReapplyStarted;

            // Disable and enable while the first request is still pending.
            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: false },
            });
            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            resolveFirstReapply(null);

            await secondReapplyStarted;
            expect(reapplyRequests).toBe(2);
        } finally {
            restoreMutationObserver();
        }
    });
});
