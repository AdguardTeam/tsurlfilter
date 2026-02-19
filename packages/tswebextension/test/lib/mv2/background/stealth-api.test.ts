import {
    describe,
    expect,
    beforeEach,
    it,
    vi,
} from 'vitest';
import { MatchingResult } from '@adguard/tsurlfilter';

import { createNetworkRule } from '../../../helpers/rule-creator';
import { type ConfigurationMV2Context } from '../../../../src/lib';
import { AppContext } from '../../../../src/lib/mv2/background/app-context';
import { StealthService } from '../../../../src/lib/mv2/background/services/stealth-service';
import { StealthApi } from '../../../../src/lib/mv2/background/stealth-api';
import { defaultFilteringLog } from '../../../../src/lib/common/filtering-log';
import { mockEngineApi } from '../../../helpers/mocks';

vi.mock('../../../../src/lib/mv2/background/app-context', async () => {
    const { MockAppContext } = await import('./mocks/mock-app-context');
    return ({
        AppContext: MockAppContext,
        appContext: new MockAppContext(),
    });
});

const getDefaultConfiguration = (): ConfigurationMV2Context => ({
    settings: {
        stealthModeEnabled: true,
        filteringEnabled: true,
        stealth: {
            hideReferrer: true,
            sendDoNotTrack: true,
        },
    },
} as ConfigurationMV2Context);

describe('StealthApi', () => {
    const appContext = new AppContext();
    appContext.configuration = getDefaultConfiguration();

    const stealthService = new StealthService(appContext, defaultFilteringLog, mockEngineApi);
    const ACTUAL_DNT_SCRIPT = stealthService.getSetDomSignalScript();
    const ACTUAL_REFERRER_SCRIPT = stealthService.getHideDocumentReferrerScript();
    const ACTUAL_STEALTH_SCRIPT = ACTUAL_DNT_SCRIPT + ACTUAL_REFERRER_SCRIPT;

    const stealthApi = new StealthApi(appContext, defaultFilteringLog, mockEngineApi);

    beforeEach(() => {
        appContext.configuration = getDefaultConfiguration();
    });

    describe('getStealthScript method', () => {
        it('returns stealth script', () => {
            expect(stealthApi.getStealthScript(null, null)).toBe(ACTUAL_STEALTH_SCRIPT);
        });

        it('only returns the script if it has corresponding option enabled', () => {
            appContext.configuration!.settings.stealth.hideReferrer = false;
            appContext.configuration!.settings.stealth.sendDoNotTrack = false;
            expect(stealthApi.getStealthScript(null, null)).toBe('');

            appContext.configuration!.settings.stealth.hideReferrer = true;
            appContext.configuration!.settings.stealth.sendDoNotTrack = false;
            expect(stealthApi.getStealthScript(null, null)).toBe(ACTUAL_REFERRER_SCRIPT);

            appContext.configuration!.settings.stealth.hideReferrer = false;
            appContext.configuration!.settings.stealth.sendDoNotTrack = true;
            expect(stealthApi.getStealthScript(null, null)).toBe(ACTUAL_DNT_SCRIPT);
        });

        it('only returns the script that is not allowlisted by $stealth rule', () => {
            let result = new MatchingResult(
                [createNetworkRule('@@||*.*^$stealth=referrer', 0)],
                null,
            );
            expect(stealthApi.getStealthScript(null, result)).toBe(ACTUAL_DNT_SCRIPT);

            result = new MatchingResult(
                [createNetworkRule('@@||*.*^$stealth=donottrack', 0)],
                null,
            );
            expect(stealthApi.getStealthScript(null, result)).toBe(ACTUAL_REFERRER_SCRIPT);
        });

        it('returns empty string if stealth mode is disabled', () => {
            appContext.configuration!.settings.stealthModeEnabled = false;
            expect(stealthApi.getStealthScript(null, null)).toBe('');
        });

        it('returns empty string if filtering is disabled', () => {
            appContext.configuration!.settings.filteringEnabled = false;
            expect(stealthApi.getStealthScript(null, null)).toBe('');
        });

        it('returns empty string if a global stealth rule is present', () => {
            const result = new MatchingResult(
                [createNetworkRule('@@||*.*^$stealth', 0)],
                null,
            );
            expect(stealthApi.getStealthScript(null, result)).toBe('');
        });

        it('returns empty string if a document rule is present', () => {
            const result = new MatchingResult(
                [],
                createNetworkRule('@@||*.*^$urlblock', 0),
            );
            expect(stealthApi.getStealthScript(null, result)).toBe('');
        });
    });
});
