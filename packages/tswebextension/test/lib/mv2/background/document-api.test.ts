import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';

import { DocumentApi } from '../../../../src/lib/mv2/background/document-api';
import { EngineApi } from '../../../../src/lib/mv2/background/engine-api';
import { Allowlist } from '../../../../src/lib/mv2/background/allowlist';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { stealthApi } from '../../../../src/lib/mv2/background/api';

vi.mock('../../../../src/lib/mv2/background/allowlist');
vi.mock('../../../../src/lib/mv2/background/engine-api');
vi.mock('../../../../src/lib/mv2/background/stealth-api');
vi.mock('../../../../src/lib/mv2/background/app-context');

describe('Document Api', () => {
    let documentApi: DocumentApi;
    let engineApi: EngineApi;
    let allowlist: Allowlist;

    beforeEach(() => {
        allowlist = new Allowlist();
        engineApi = new EngineApi(allowlist, appContext, stealthApi);
        documentApi = new DocumentApi(allowlist, engineApi);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('matchFrame method', () => {
        const cases = [
            {
                title: 'should call engine.matchFrame, when API is not enabled',
                enabled: false,
                inverted: true,
                url: 'https://example.com',
                domains: ['example.com'],
            },
            {
                title: 'should call engine.matchFrame, when API is enabled and not inverted',
                enabled: true,
                inverted: false,
                url: 'https://example.com',
                domains: ['example.com'],
            },
            {
                title: 'should call engine.matchFrame, when API is enabled and not inverted',
                enabled: true,
                inverted: false,
                url: 'https://test.example.com',
                domains: ['*.example.com'],
            },
            {
                title: 'should call engine.matchFrame, when domain is allowlisted and API is inverted',
                enabled: true,
                inverted: true,
                url: 'https://example.com',
                domains: ['example.com'],
            },
            {
                title: 'should call engine.matchFrame, when domain mask is allowlisted and API is inverted',
                enabled: true,
                inverted: true,
                url: 'https://test.example.com',
                domains: ['*.example.com'],
            },
            {
                title: 'should return custom rule, when domain is not allowlisted and API is inverted',
                enabled: true,
                inverted: true,
                url: 'https://example.com',
                domains: [],
            },
        ];

        it.each(cases)('$title', ({
            inverted,
            url,
            domains,
        }) => {
            allowlist.inverted = inverted;
            allowlist.domains = domains;

            documentApi.matchFrame(url);

            expect(engineApi.matchFrame).toBeCalledWith(url);
        });
    });
});
