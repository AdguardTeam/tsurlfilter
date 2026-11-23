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
import { logger } from '../../../../../src/lib/common/utils/logger';
import { appContext } from '../../../../../src/lib/mv3/background/app-context';
import { type ConfigurationMV3Context } from '../../../../../src/lib/mv3/background/configuration';
import { engineApi } from '../../../../../src/lib/mv3/background/engine-api';
import { type RequestContext, RequestContextState } from '../../../../../src/lib/mv3/background/request';
import { StealthService } from '../../../../../src/lib/mv3/background/services/stealth-service';
import { createNetworkRule } from '../../../../helpers/rule-creator';

vi.mock('../../../../../src/lib/common/utils/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

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

describe('StealthService content script management', () => {
    let mockRegister: ReturnType<typeof vi.fn>;
    let mockUnregister: ReturnType<typeof vi.fn>;
    let mockUpdate: ReturnType<typeof vi.fn>;
    let mockGetRegistered: ReturnType<typeof vi.fn>;
    let originalChrome: typeof global.chrome;
    let registeredIds: Set<string>;

    beforeEach(() => {
        registeredIds = new Set();
        mockRegister = vi.fn().mockImplementation((scripts: { id: string }[]) => {
            scripts.forEach((s) => registeredIds.add(s.id));
            return Promise.resolve(undefined);
        });
        mockUnregister = vi.fn().mockImplementation((filter: { ids: string[] }) => {
            filter.ids.forEach((id) => registeredIds.delete(id));
            return Promise.resolve(undefined);
        });
        mockUpdate = vi.fn().mockImplementation((scripts: { id: string }[]) => {
            scripts.forEach((s) => registeredIds.add(s.id));
            return Promise.resolve(undefined);
        });
        mockGetRegistered = vi.fn().mockImplementation(() => {
            return Promise.resolve(
                [...registeredIds].map((id) => ({ id, js: [], matches: [] })),
            );
        });

        originalChrome = global.chrome;
        global.chrome = {
            ...global.chrome,
            scripting: {
                ...global.chrome.scripting,
                registerContentScripts: mockRegister,
                unregisterContentScripts: mockUnregister,
                updateContentScripts: mockUpdate,
                getRegisteredContentScripts: mockGetRegistered,
            },
            declarativeNetRequest: {
                ...global.chrome.declarativeNetRequest,
                updateSessionRules: vi.fn().mockResolvedValue(undefined),
                RuleActionType: {
                    MODIFY_HEADERS: 'modifyHeaders',
                },
                HeaderOperation: {
                    REMOVE: 'remove',
                    SET: 'set',
                },
                ResourceType: {
                    MAIN_FRAME: 'main_frame',
                    SUB_FRAME: 'sub_frame',
                    STYLESHEET: 'stylesheet',
                    SCRIPT: 'script',
                    IMAGE: 'image',
                    FONT: 'font',
                    OBJECT: 'object',
                    XMLHTTPREQUEST: 'xmlhttprequest',
                    PING: 'ping',
                    CSP_REPORT: 'csp_report',
                    MEDIA: 'media',
                    WEBSOCKET: 'websocket',
                    OTHER: 'other',
                },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
    });

    afterEach(() => {
        global.chrome = originalChrome;
    });

    it('should register GPC content script with stealth namespace prefix', async () => {
        const result = await StealthService.setSendDoNotTrack(true, '/scripts/gpc.js');

        expect(result).toBe(true);
        // Since the script doesn't exist yet, upsert() calls register()
        const registeredCall = mockRegister.mock.calls[0][0];
        expect(registeredCall[0].id).toBe('stealth:gpc');
    });

    it('should unregister GPC content script with stealth namespace prefix', async () => {
        await StealthService.setSendDoNotTrack(true, '/scripts/gpc.js');
        mockUnregister.mockClear();

        const result = await StealthService.setSendDoNotTrack(false, '/scripts/gpc.js');

        expect(result).toBe(false);
        const unregisterCall = mockUnregister.mock.calls[0][0];
        expect(unregisterCall.ids).toContain('stealth:gpc');
    });

    it('should register document-referrer with stealth namespace prefix', async () => {
        const result = await StealthService.setHideSearchQueries(true, '/scripts/referrer.js');

        expect(result).toBe(true);
        // Since the script doesn't exist yet, upsert() calls register()
        const registeredCall = mockRegister.mock.calls[0][0];
        expect(registeredCall[0].id).toBe('stealth:documentReferrer');
    });

    it('should clear all stealth content scripts via ContentScriptManager.clear()', async () => {
        await StealthService.setSendDoNotTrack(true, '/scripts/gpc.js');
        await StealthService.setHideSearchQueries(true, '/scripts/referrer.js');
        mockUnregister.mockClear();

        await StealthService.clearAll();

        expect(mockGetRegistered).toHaveBeenCalled();
        expect(mockUnregister).toHaveBeenCalled();
    });

    it('should not throw when ContentScriptManager.clear() rejects', async () => {
        // Simulate ContentScriptManager.clear() failing by making
        // getRegisteredContentScripts reject.
        mockGetRegistered.mockRejectedValueOnce(new Error('Clear failed'));

        const result = await StealthService.clearAll();

        expect(result).toBeDefined();
        expect(result).toHaveLength(1);

        expect(result[0].reason).toBeInstanceOf(Error);
        expect(result[0].reason.message).toBe('Clear failed');

        const stealthErrors = vi.mocked(logger.error).mock.calls.filter(
            (call) => typeof call[0] === 'string' && call[0].includes('[tsweb.StealthService.clearAll]'),
        );
        expect(stealthErrors).toHaveLength(1);
        expect(stealthErrors[0][0]).toContain('1 cleanup step(s) failed:\nClear failed\nError: Clear failed');
    });
});
