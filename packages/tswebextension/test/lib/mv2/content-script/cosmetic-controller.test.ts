/**
 * @vitest-environment jsdom
 */

import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';
import { CosmeticResult } from '@adguard/tsurlfilter';

import { createCosmeticRule } from '../../../helpers/rule-creator';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { CosmeticController } from '../../../../src/lib/mv2/content-script/cosmetic-controller';
import * as SendMessageModule from '../../../../src/lib/common/content-script/send-app-message';
import { type ContentScriptCosmeticData } from '../../../../src/lib/common/cosmetic-api';

vi.mock('../../../../src/lib/common/content-script/send-app-message', () => {
    const module = vi.importActual('../../../../src/lib/common/content-script/send-app-message');
    return module;
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

    it('no hits counter', async () => {
        const rules = [
            '#?##bannerOff:remove()',
            '#?#.ad_header:contains(text)',
        ];

        // Mocking the sendAppMessage function
        vi.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue(getCosmeticData(rules, false));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        expect(cosmeticController).toBeDefined();

        // Wait for the cosmetic controller to process (using a delay)
        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });

        const headerElement = document.getElementById('headerOff');
        if (!headerElement) {
            throw new Error('#headerOff element is required');
        }

        const headerDisplayStyleValue = headerElement.style.getPropertyValue('display');
        expect(headerDisplayStyleValue).toEqual('none');
    });

    it('hits counter enabled', async () => {
        const rules = [
            '#?##bannerOn:remove()',
            '#?#.ad_header:contains(text)',
        ];

        // Mocking the sendAppMessage function
        vi.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue(getCosmeticData(rules, true));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        expect(cosmeticController).toBeDefined();

        // Wait for the cosmetic controller to process (using a delay)
        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });

        const headerElement = document.getElementById('headerOn');
        if (!headerElement) {
            throw new Error('#headerOn element is required');
        }

        const headerDisplayStyleValue = headerElement.style.getPropertyValue('display');
        expect(headerDisplayStyleValue).toEqual('none');
    });
});
