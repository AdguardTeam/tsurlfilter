import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { NetworkRule } from '@adguard/tsurlfilter';

import { allowlistApi } from '../../../../src/lib/mv3/background/allowlist-api';
import { DocumentApi } from '../../../../src/lib/mv3/background/document-api';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { getConfigurationMv3Fixture } from '../fixtures/configuration';

vi.mock('../../../../src/lib/mv3/background/engine-api');

describe('Document Api', () => {
    const engineRule = new NetworkRule('||engine.example^', 1);

    beforeEach(() => {
        vi.mocked(engineApi.matchFrame).mockReturnValue(engineRule);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('matchFrame method', () => {
        const cases = [
            {
                title: 'delegates when the allowlist is disabled',
                enabled: false,
                inverted: true,
                url: 'https://example.com',
                domains: ['example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'delegates in regular mode with a wildcard entry',
                enabled: true,
                inverted: false,
                url: 'https://test.example.com',
                domains: ['*.example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'keeps filtering on the apex for a subdomain wildcard',
                enabled: true,
                inverted: true,
                url: 'https://example.com',
                domains: ['*.example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'keeps filtering on a direct subdomain for a subdomain wildcard',
                enabled: true,
                inverted: true,
                url: 'https://b.example.com',
                domains: ['*.example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'keeps filtering on a deep subdomain for a subdomain wildcard',
                enabled: true,
                inverted: true,
                url: 'https://a.b.example.com',
                domains: ['*.example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'keeps filtering on the apex for a TLD wildcard',
                enabled: true,
                inverted: true,
                url: 'https://example.com',
                domains: ['example.*'],
                expectedEngineMatch: true,
            },
            {
                title: 'keeps filtering on a direct subdomain for a TLD wildcard',
                enabled: true,
                inverted: true,
                url: 'https://b.example.com',
                domains: ['example.*'],
                expectedEngineMatch: true,
            },
            {
                title: 'keeps filtering on a deep subdomain for a TLD wildcard',
                enabled: true,
                inverted: true,
                url: 'https://a.b.example.com',
                domains: ['example.*'],
                expectedEngineMatch: true,
            },
            {
                title: 'keeps filtering on the apex for a plain entry',
                enabled: true,
                inverted: true,
                url: 'https://example.com',
                domains: ['example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'keeps filtering on www for a plain entry',
                enabled: true,
                inverted: true,
                url: 'https://www.example.com',
                domains: ['example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'retains MV3 plain-entry coverage on a direct subdomain',
                enabled: true,
                inverted: true,
                url: 'https://b.example.com',
                domains: ['example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'retains MV3 plain-entry coverage on a deep subdomain',
                enabled: true,
                inverted: true,
                url: 'https://a.b.example.com',
                domains: ['example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'disables filtering on an unrelated host',
                enabled: true,
                inverted: true,
                url: 'https://other.org',
                domains: ['*.example.com', 'example.*'],
                expectedEngineMatch: false,
            },
            {
                title: 'disables filtering everywhere for an empty inverted list',
                enabled: true,
                inverted: true,
                url: 'https://example.com',
                domains: [],
                expectedEngineMatch: false,
            },
            {
                title: 'filters every host for the inverted full wildcard',
                enabled: true,
                inverted: true,
                url: 'https://other.org',
                domains: ['*.*'],
                expectedEngineMatch: true,
            },
            {
                title: 'disables filtering for an entry DNR cannot express',
                enabled: true,
                inverted: true,
                url: 'https://myexample.com',
                domains: ['*example.com'],
                expectedEngineMatch: false,
            },
            {
                title: 'disables filtering on a TLD outside the DNR expansion',
                enabled: true,
                inverted: true,
                url: 'https://example.ly',
                domains: ['example.*'],
                expectedEngineMatch: false,
            },
            {
                title: 'does not extend a TLD wildcard to every www host',
                enabled: true,
                inverted: true,
                url: 'https://www.example.com',
                domains: ['www.*'],
                expectedEngineMatch: false,
            },
            {
                title: 'reads the www prefix of a TLD wildcard from the full host',
                enabled: true,
                inverted: true,
                url: 'https://www.com',
                domains: ['www.*'],
                expectedEngineMatch: true,
            },
            {
                title: 'drops an imported entry that has no allowlist rule',
                enabled: true,
                inverted: true,
                url: 'https://example.com',
                domains: ['0.0.0.0 example.com'],
                expectedEngineMatch: false,
            },
        ];

        it.each(cases)('$title', ({
            enabled,
            inverted,
            url,
            domains,
            expectedEngineMatch,
        }) => {
            const configuration = getConfigurationMv3Fixture();
            configuration.allowlist = domains;
            configuration.settings.allowlistEnabled = enabled;
            configuration.settings.allowlistInverted = inverted;
            allowlistApi.configure(configuration);

            const result = DocumentApi.matchFrame(url);

            if (expectedEngineMatch) {
                expect(engineApi.matchFrame).toHaveBeenCalledWith(url);
                expect(result).toBe(engineRule);
                return;
            }

            expect(engineApi.matchFrame).not.toHaveBeenCalled();
            expect(result).toBeInstanceOf(NetworkRule);
            expect(result?.isAllowlist()).toBe(true);
        });

        it('returns null for a hostless URL without consulting the engine', () => {
            const configuration = getConfigurationMv3Fixture();
            configuration.settings.allowlistEnabled = true;
            configuration.settings.allowlistInverted = true;
            allowlistApi.configure(configuration);

            expect(DocumentApi.matchFrame('invalid-url')).toBeNull();
            expect(engineApi.matchFrame).not.toHaveBeenCalled();
        });
    });
});
