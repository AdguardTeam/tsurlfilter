import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { logger } from '../../../../../src/lib/common/utils/logger';
import { StealthService } from '../../../../../src/lib/mv3/background/services/stealth-service';

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
