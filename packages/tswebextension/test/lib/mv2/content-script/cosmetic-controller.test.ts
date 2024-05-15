/**
 * @jest-environment jsdom
 */

import { CosmeticResult, CosmeticRule } from '@adguard/tsurlfilter';
import { type ContentScriptCosmeticData, CosmeticApi } from '@lib/mv2/background/cosmetic-api';
import { CosmeticController } from '@lib/mv2/content-script/cosmetic-controller';

import * as SendMessageModule from '@lib/common/content-script/send-app-message';

jest.mock('@lib/common/content-script/send-app-message', () => {
    return {
        __esModule: true,
        ...jest.requireActual('@lib/common/content-script/send-app-message'),
    };
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
        cosmeticResult.elementHiding.append(new CosmeticRule(rule, 0));
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
    const extCssRules = CosmeticApi.getExtCssRules(cosmeticResult, areHitsStatsCollected);
    return {
        isAppStarted: true,
        areHitsStatsCollected,
        extCssRules,
    };
};

describe('some extended css rules are invalid', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="headerOff" class="ad_header" style="display: block">test text</div>
            <div id="bannerOff" style="display: block"></div>

            <div id="headerOn" class="ad_header" style="display: block">test text</div>
            <div id="bannerOn" style="display: block"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('no hits counter', (done) => {
        const rules = [
            '#?##bannerOff:remove()',
            '#?#.ad_header:contains(text)',
        ];
        // 'false' to disable hits counter
        jest.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue(getCosmeticData(rules, false));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        expect(cosmeticController).toBeDefined();

        setTimeout(() => {
            const headerElement = document.getElementById('headerOff');
            if (!headerElement) {
                throw new Error('#headerOff element is required');
            }
            const headerDisplayStyleValue = headerElement.style.getPropertyValue('display');
            expect(headerDisplayStyleValue).toEqual('none');
            done();
        }, 20);
    });

    it('hits counter enabled', (done) => {
        const rules = [
            '#?##bannerOn:remove()',
            '#?#.ad_headerOn:contains(text)',
        ];
        // 'true' to enable hits counter
        jest.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue(getCosmeticData(rules, true));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        expect(cosmeticController).toBeDefined();

        setTimeout(() => {
            const headerElement = document.getElementById('headerOn');
            if (!headerElement) {
                throw new Error('#headerOn element is required');
            }
            const headerDisplayStyleValue = headerElement.style.getPropertyValue('display');
            expect(headerDisplayStyleValue).toEqual('none');
            done();
        }, 20);
    });
});
