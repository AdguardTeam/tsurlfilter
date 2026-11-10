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
});
