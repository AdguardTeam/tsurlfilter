import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { NetworkRule } from '@adguard/tsurlfilter';

import { Allowlist } from '../../../../src/lib/mv2/background/allowlist';
import { stealthApi } from '../../../../src/lib/mv2/background/api';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { DocumentApi } from '../../../../src/lib/mv2/background/document-api';
import { EngineApi } from '../../../../src/lib/mv2/background/engine-api';

vi.mock('../../../../src/lib/mv2/background/engine-api');
vi.mock('../../../../src/lib/mv2/background/stealth-api');
vi.mock('../../../../src/lib/mv2/background/app-context');

describe('Document Api', () => {
    const engineRule = new NetworkRule('||engine.example^', 1);

    let documentApi: DocumentApi;
    let engineApi: EngineApi;
    let allowlist: Allowlist;

    beforeEach(() => {
        allowlist = new Allowlist();
        engineApi = new EngineApi(allowlist, appContext, stealthApi);
        vi.mocked(engineApi.matchFrame).mockReturnValue(engineRule);
        documentApi = new DocumentApi(allowlist, engineApi);
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
                title: 'delegates in regular mode with a plain entry',
                enabled: true,
                inverted: false,
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
                title: 'preserves plain-entry behavior on another subdomain',
                enabled: true,
                inverted: true,
                url: 'https://b.example.com',
                domains: ['example.com'],
                expectedEngineMatch: false,
            },
            {
                title: 'preserves plain-entry behavior on a deep subdomain',
                enabled: true,
                inverted: true,
                url: 'https://a.b.example.com',
                domains: ['example.com'],
                expectedEngineMatch: false,
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
                title: 'matches a wildcard inside a label',
                enabled: true,
                inverted: true,
                url: 'https://myexample.com',
                domains: ['*example.com'],
                expectedEngineMatch: true,
            },
            {
                title: 'matches the www host of a TLD wildcard',
                enabled: true,
                inverted: true,
                url: 'https://www.example.com',
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
            allowlist.enabled = enabled;
            allowlist.inverted = inverted;
            allowlist.domains = domains;

            const result = documentApi.matchFrame(url);

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
            allowlist.enabled = true;
            allowlist.inverted = true;
            allowlist.domains = ['example.com'];

            expect(documentApi.matchFrame('invalid-url')).toBeNull();
            expect(engineApi.matchFrame).not.toHaveBeenCalled();
        });
    });
});
