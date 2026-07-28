import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { StealthService } from '../../../../../src/lib/mv3/background/services/stealth-service';

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
