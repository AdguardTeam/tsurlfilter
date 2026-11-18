import { runInThisContext } from 'node:vm';

import browser from 'sinon-chrome';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/extcss-protocol';
import { tabsApi } from '../../../../src/lib/mv2/background/api';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { serializeExtCssForCode } from '../../../../src/lib/mv2/background/extcss-code';
import { FrameMV2, type PreparedCosmeticResultMV2 } from '../../../../src/lib/mv2/background/tabs/frame';

vi.mock('../../../../src/lib/mv2/background/api', () => ({
    engineApi: {},
    tabsApi: {
        getFrameContext: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv2/background/app-context', () => ({
    appContext: {},
}));

vi.mock('../../../../src/lib/mv2/background/services/local-script-rules-service', () => ({
    localScriptRulesService: {},
}));

const RULES = ['.ad:has(.child) { display: none !important; }'];

/**
 * The same rule set with hit markers, as the marked-data reapply builds it.
 */
const MARKED_RULES = [
    ".ad:has(.child) { display: none !important; content: 'adguard0%3B1' !important; }",
];

/**
 * Creates a frame context with an ExtCSS rule set that matches the DOM below.
 *
 * @returns The frame context.
 */
const makeFrameContext = (): FrameMV2 => {
    const preparedCosmeticResult: PreparedCosmeticResultMV2 = {
        scriptText: '',
        extCssRules: RULES,
        areHitsStatsCollected: false,
    };

    const frameContext = new FrameMV2({
        url: 'https://example.com/',
        tabId: 1,
        frameId: 0,
        parentFrameId: -1,
        timeStamp: Date.now(),
    });
    frameContext.preparedCosmeticResult = preparedCosmeticResult;

    return frameContext;
};

describe('MV2 ExtCSS injection chain', () => {
    beforeEach(() => {
        vi.mocked(tabsApi.getFrameContext).mockReset();
        browser.tabs.executeScript.resetHistory();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('passes the serialized payload to executeScript and the page applies it', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(makeFrameContext());

        await CosmeticApi.applyExtCss(1, 0);

        expect(browser.tabs.executeScript.callCount).toBe(1);

        const [tabId, injectDetails] = browser.tabs.executeScript.firstCall.args;
        expect(tabId).toBe(1);
        expect(injectDetails).toEqual({
            code: serializeExtCssForCode(RULES, false, EXTCSS_PROTOCOL),
            frameId: 0,
            runAt: 'document_start',
            matchAboutBlank: true,
        });

        // Evaluate exactly what the browser receives, not a rebuilt copy.
        runInThisContext(injectDetails.code);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('does not let an unmarked retry overtake the forced marked payload', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        vi.useFakeTimers();

        try {
            const frameContext = makeFrameContext();
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

            const executions: string[] = [];

            /**
             * Evaluates the code of an injection call and records it.
             *
             * @param call Call of the `executeScript` stub.
             * @param call.args Arguments of the call.
             */
            const execute = (call: { args: unknown[] }): void => {
                const [, details] = call.args as [number, { code: string }];
                runInThisContext(details.code);
                executions.push(details.code);
            };

            // The first attempt fails, so the unmarked payload waits for its
            // retry instead of reaching the page.
            browser.tabs.executeScript
                .onFirstCall()
                .callsFake(() => Promise.reject(new Error('Missing host permission')))
                .onSecondCall()
                .returns(undefined);

            const unmarked = CosmeticApi.applyExtCss(1, 0);
            await vi.advanceTimersByTimeAsync(0);

            // The marked reapply arrives while the unmarked retry waits.
            const marked = CosmeticApi.applyExtCss(1, 0, {
                extCssData: { extCssRules: MARKED_RULES, areHitsStatsCollected: true },
                force: true,
            });

            await vi.advanceTimersByTimeAsync(10);

            const isMarkedApplied = await marked;
            const isUnmarkedApplied = await unmarked;

            // The superseded payload stops at its retry boundary, so no
            // unmarked retry runs after the marked payload.
            expect(browser.tabs.executeScript.callCount).toBe(2);
            expect(isMarkedApplied).toBe(true);
            expect(isUnmarkedApplied).toBe(false);

            execute(browser.tabs.executeScript.secondCall);

            expect(executions).toHaveLength(1);
            expect(executions[0]).toBe(
                serializeExtCssForCode(MARKED_RULES, true, EXTCSS_PROTOCOL),
            );

            const retained = (window as unknown as Record<
                string, { cssRules?: string[] } | undefined
            >)[EXTCSS_PROTOCOL.instanceKey];
            expect(retained?.cssRules).toEqual(MARKED_RULES);
            expect(frameContext.extCssAppliedData).toEqual(MARKED_RULES);
            expect(frameContext.extCssHitsMarkersApplied).toBe(true);
            expect(frameContext.extCssInjectionChain).toBeUndefined();
        } finally {
            vi.useRealTimers();
        }
    });

    it('runs the payloads in start order so the marked copy lands last', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        const frameContext = makeFrameContext();
        vi.mocked(tabsApi.getFrameContext).mockReturnValue(frameContext);

        const executions: string[] = [];

        /**
         * Evaluates the code of an injection call and records it.
         *
         * @param call Call of the `executeScript` stub.
         * @param call.args Arguments of the call.
         */
        const execute = (call: { args: unknown[] }): void => {
            const [, details] = call.args as [number, { code: string }];
            runInThisContext(details.code);
            executions.push(details.code);
        };

        let resolveFirst!: (value?: unknown) => void;

        browser.tabs.executeScript
            .onFirstCall()
            .returns(new Promise((resolve) => {
                resolveFirst = resolve;
            }))
            .onSecondCall()
            .returns(undefined);

        const unmarked = CosmeticApi.applyExtCss(1, 0);
        const marked = CosmeticApi.applyExtCss(1, 0, {
            extCssData: { extCssRules: MARKED_RULES, areHitsStatsCollected: true },
            force: true,
        });

        // The marked payload must not reach the browser while the unmarked one
        // is still in flight: the payload disposes the applied instance first.
        await Promise.resolve();
        await Promise.resolve();
        expect(browser.tabs.executeScript.callCount).toBe(1);

        execute(browser.tabs.executeScript.firstCall);
        resolveFirst();
        await unmarked;

        await Promise.resolve();
        await Promise.resolve();
        expect(browser.tabs.executeScript.callCount).toBe(2);

        execute(browser.tabs.executeScript.secondCall);
        await marked;

        // The unmarked payload ran first and the marked one last, so the page
        // keeps the instance that reports hits.
        expect(executions).toHaveLength(2);
        expect(executions[0]).not.toBe(executions[1]);
        const retained = (window as unknown as Record<string, { cssRules?: string[] } | undefined>)[
            EXTCSS_PROTOCOL.instanceKey
        ];
        expect(retained?.cssRules).toEqual(MARKED_RULES);
        expect(frameContext.extCssAppliedData).toEqual(MARKED_RULES);
        expect(frameContext.extCssHitsMarkersApplied).toBe(true);
    });
});
