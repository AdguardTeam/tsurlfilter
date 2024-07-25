import { DocumentApi } from '../../../../src/lib/mv2/background/document-api';
import { EngineApi } from '../../../../src/lib/mv2/background/engine-api';
import { Allowlist } from '../../../../src/lib/mv2/background/allowlist';
import { appContext } from '../../../../src/lib/mv2/background/context';
import { stealthApi } from '../../../../src/lib/mv2/background/stealth-api';

jest.mock('@lib/mv2/background/allowlist');
jest.mock('@lib/mv2/background/engine-api');
jest.mock('@lib/mv2/background/stealth-api');
jest.mock('@lib/mv2/background/context');

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
        jest.resetAllMocks();
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
                title: 'should call engine.matchFrame, when API is not inverted',
                enabled: true,
                inverted: false,
                url: 'https://example.com',
                domains: ['example.com'],
            },
            {
                title: 'should call engine.matchFrame, when domain is allowlisted and API is inverted',
                enabled: true,
                inverted: true,
                url: 'https://example.com',
                domains: ['example.com'],
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
