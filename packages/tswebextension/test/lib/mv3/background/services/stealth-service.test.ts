import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    HTTPMethod,
    MatchingResult,
    RequestType,
    RULE_INDEX_NONE,
} from '@adguard/tsurlfilter';

import { defaultFilteringLog, FilteringEventType } from '../../../../../src/lib/common/filtering-log';
import { ContentType } from '../../../../../src/lib/common/request-type';
import { appContext } from '../../../../../src/lib/mv3/background/app-context';
import { type ConfigurationMV3Context } from '../../../../../src/lib/mv3/background/configuration';
import { engineApi } from '../../../../../src/lib/mv3/background/engine-api';
import { type RequestContext, RequestContextState } from '../../../../../src/lib/mv3/background/request';
import { StealthService } from '../../../../../src/lib/mv3/background/services/stealth-service';
import { createNetworkRule } from '../../../../helpers/rule-creator';

describe('StealthService', () => {
    describe('setDisableWebRTC', () => {
        const mockSet = vi.fn().mockResolvedValue(undefined);
        const mockClear = vi.fn().mockResolvedValue(undefined);
        const mockGet = vi.fn().mockResolvedValue({
            levelOfControl: 'controllable_by_this_extension',
            value: 'default',
        });

        beforeEach(() => {
            vi.clearAllMocks();

            // Mock chrome.permissions.contains
            global.chrome = {
                ...global.chrome,
                permissions: {
                    ...global.chrome.permissions,
                    contains: vi.fn().mockResolvedValue(true),
                },
                privacy: {
                    ...global.chrome.privacy,
                    network: {
                        webRTCIPHandlingPolicy: {
                            set: mockSet,
                            clear: mockClear,
                            get: mockGet,
                        },
                    },
                    IPHandlingPolicy: {
                        DEFAULT: 'default',
                        DEFAULT_PUBLIC_AND_PRIVATE_INTERFACES: 'default_public_and_private_interfaces',
                        DEFAULT_PUBLIC_INTERFACE_ONLY: 'default_public_interface_only',
                        DISABLE_NON_PROXIED_UDP: 'disable_non_proxied_udp',
                    },
                },
            } as any;
        });

        it('should set policy to DEFAULT_PUBLIC_INTERFACE_ONLY when WebRTC disabled', async () => {
            const result = await StealthService.setDisableWebRTC(true);

            expect(result).toBe(true);
            expect(mockSet).toHaveBeenCalledWith({
                value: 'default_public_interface_only',
                scope: 'regular',
            });
        });

        it('should clear policy when WebRTC not disabled', async () => {
            const result = await StealthService.setDisableWebRTC(false);

            expect(result).toBe(false);
            expect(mockClear).toHaveBeenCalledWith({
                scope: 'regular',
            });
        });

        it('should return opposite value when permissions not granted and WebRTC disabled', async () => {
            (global.chrome.permissions.contains as ReturnType<typeof vi.fn>).mockResolvedValue(false);

            const result = await StealthService.setDisableWebRTC(true);

            expect(result).toBe(false);
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('should return false and skip setting when permissions not granted and WebRTC not disabled', async () => {
            (global.chrome.permissions.contains as ReturnType<typeof vi.fn>).mockResolvedValue(false);

            const result = await StealthService.setDisableWebRTC(false);

            expect(result).toBe(false);
            expect(mockClear).not.toHaveBeenCalled();
        });
    });

    describe('onBeforeSendHeaders', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        /**
         * Processes a document request and returns the stealth exceptions published for it.
         *
         * @param protectCanvas Whether canvas protection is enabled.
         * @param rule Rule matching the request.
         * @param ruleIndex Index of the rule in its filter list, {@link RULE_INDEX_NONE} for a rule
         * that keeps its own text.
         *
         * @returns Applied rule texts of the published event, if any.
         */
        const publishedExceptions = (
            protectCanvas: boolean,
            rule: string,
            ruleIndex = RULE_INDEX_NONE,
        ): string[] | undefined => {
            const publishEvent = vi.spyOn(defaultFilteringLog, 'publishEvent');
            publishEvent.mockClear();
            vi.spyOn(appContext, 'configuration', 'get').mockReturnValue({
                settings: {
                    filteringEnabled: true,
                    stealthModeEnabled: true,
                    stealth: {
                        blockChromeClientData: false,
                        hideReferrer: false,
                        hideSearchQueries: false,
                        sendDoNotTrack: false,
                        protectCanvas,
                    },
                },
            } as ConfigurationMV3Context);
            const context: RequestContext = {
                eventId: '1',
                state: RequestContextState.BeforeSendHeaders,
                requestId: '1',
                requestUrl: 'https://example.org/',
                referrerUrl: 'https://example.org/',
                requestType: RequestType.Document,
                contentType: ContentType.Document,
                tabId: 1,
                frameId: 0,
                timestamp: Date.now(),
                thirdParty: false,
                method: HTTPMethod.GET,
                requestHeaders: [],
                matchingResult: new MatchingResult([createNetworkRule(rule, 1, ruleIndex)], null),
            };
            StealthService.onBeforeSendHeaders(context);
            const event = publishEvent.mock.calls
                .map(([published]) => published)
                .find(({ type }) => type === FilteringEventType.StealthAllowlistAction);
            return event?.type === FilteringEventType.StealthAllowlistAction
                ? event.data.rules.map(({ appliedRuleText }) => appliedRuleText)
                : undefined;
        };

        it('publishes the exception that keeps a document native', () => {
            expect(publishedExceptions(true, '@@||example.org^$stealth=fingerprinting'))
                .toEqual(['@@||example.org^$stealth=fingerprinting']);
            expect(publishedExceptions(true, '@@||example.org^$stealth')).toEqual(['@@||example.org^$stealth']);
        });

        it('publishes the text of an exception loaded from a filter list', () => {
            const rules = ['@@||example.org^$stealth=fingerprinting', '@@||example.org^$stealth'];
            vi.spyOn(engineApi, 'retrieveRuleText').mockImplementation((filterListId, ruleIndex) => (
                filterListId === 1 ? rules[ruleIndex] ?? null : null
            ));
            vi.spyOn(engineApi, 'retrieveOriginalRuleText').mockReturnValue(null);

            expect(publishedExceptions(true, rules[0], 0)).toEqual([rules[0]]);
            expect(publishedExceptions(true, rules[1], 1)).toEqual([rules[1]]);
        });

        it('publishes nothing while canvas protection is off', () => {
            expect(publishedExceptions(false, '@@||example.org^$stealth=fingerprinting')).toBeUndefined();
        });
    });
});
