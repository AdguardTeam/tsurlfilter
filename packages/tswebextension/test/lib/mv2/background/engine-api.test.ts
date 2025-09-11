import {
    describe,
    expect,
    beforeAll,
    beforeEach,
    afterAll,
    afterEach,
    it,
    vi,
    type MockInstance,
} from 'vitest';
import browser from 'sinon-chrome';
import { type CosmeticOption, Engine, CosmeticResult } from '@adguard/tsurlfilter';

import { type MatchQuery } from '../../../../src/lib/common/interfaces';
import { EngineApi } from '../../../../src/lib/mv2/background/engine-api';
import { Allowlist } from '../../../../src/lib/mv2/background/allowlist';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { stealthApi } from '../../../../src/lib/mv2/background/stealth-api';

import { getConfigurationMv2Fixture } from './fixtures/configuration';

vi.mock('../../../../src/lib/mv2/background/allowlist');
vi.mock('../../../../src/lib/mv2/background/app-context');
vi.mock('../../../../src/lib/mv2/background/stealth-api');

describe('Engine Api', () => {
    let engineApi: EngineApi;

    beforeAll(() => {
        browser.runtime.getManifest.returns({ version: '2' });
    });

    beforeEach(() => {
        const allowlist = new Allowlist();
        engineApi = new EngineApi(allowlist, appContext, stealthApi);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(() => {
        browser.runtime.getManifest.reset();
    });

    const startEngine = async (): Promise<void> => {
        const configuration = getConfigurationMv2Fixture();

        await engineApi.startEngine(configuration);
    };

    const setFilteringEnabled = (enabled: boolean): void => {
        vi.spyOn(engineApi, 'isFilteringEnabled', 'get').mockReturnValue(enabled);
    };

    describe('startEngine method', () => {
        it('should run tsurlfilter engine', () => {
            vi.spyOn(Engine, 'createAsync');

            const configuration = getConfigurationMv2Fixture();

            engineApi.startEngine(configuration);
            expect(Engine.createAsync).toHaveBeenCalled();
        });
    });

    describe('matchRequest method', () => {
        it('should return tsurlfilter data when engine is started', async () => {
            vi.spyOn(Engine.prototype, 'matchRequest');

            await startEngine();
            setFilteringEnabled(true);

            engineApi.matchRequest({
                requestUrl: 'https://example.com',
                frameUrl: 'https://example.com',
            } as MatchQuery);

            expect(Engine.prototype.matchRequest).toHaveBeenCalled();
        });

        it('should return null when filtering is disabled', async () => {
            vi.spyOn(Engine.prototype, 'matchRequest');

            await startEngine();
            setFilteringEnabled(false);

            expect(engineApi.matchRequest({
                requestUrl: 'https://example.com',
                frameUrl: 'https://example.com',
            } as MatchQuery)).toBeNull();
            expect(Engine.prototype.matchRequest).not.toHaveBeenCalled();
        });

        it('should return null when engine is not started', () => {
            vi.spyOn(Engine.prototype, 'matchRequest');

            expect(engineApi.matchRequest({
                requestUrl: 'https://example.com',
                frameUrl: 'https://example.com',
            } as MatchQuery)).toBeNull();
            expect(Engine.prototype.matchRequest).not.toHaveBeenCalled();
        });
    });

    describe('matchFrame method', () => {
        let matchFrameSpy: MockInstance<typeof Engine.prototype.matchFrame>;

        beforeEach(() => {
            matchFrameSpy = vi.spyOn(Engine.prototype, 'matchFrame');
        });

        afterEach(() => {
            matchFrameSpy.mockClear();
        });

        it('should return tsurlfilter data when engine is started', async () => {
            await startEngine();
            setFilteringEnabled(true);

            engineApi.matchFrame('https://example.com');

            expect(Engine.prototype.matchFrame).toHaveBeenCalled();
        });

        it('should return null when filtering is disabled', async () => {
            await startEngine();
            setFilteringEnabled(false);

            expect(engineApi.matchFrame('https://example.com')).toBeNull();
            expect(Engine.prototype.matchFrame).not.toHaveBeenCalled();
        });

        it('should return null when engine is not started', () => {
            expect(engineApi.matchFrame('https://example.com')).toBeNull();
            expect(Engine.prototype.matchFrame).not.toHaveBeenCalled();
        });
    });

    describe('getCosmeticResult method', () => {
        let getCosmeticResultSpy: MockInstance<typeof Engine.prototype.getCosmeticResult>;

        beforeEach(() => {
            getCosmeticResultSpy = vi.spyOn(Engine.prototype, 'getCosmeticResult');
        });

        afterEach(() => {
            getCosmeticResultSpy.mockClear();
        });

        it('should return tsurlfilter data', async () => {
            await startEngine();
            setFilteringEnabled(true);

            engineApi.getCosmeticResult('https://example.com', {} as CosmeticOption);

            expect(Engine.prototype.getCosmeticResult).toHaveBeenCalled();
        });

        it('should return default CosmeticResult when filtering is disabled', async () => {
            await startEngine();
            setFilteringEnabled(false);

            expect(engineApi.getCosmeticResult('https://example.com', {} as CosmeticOption)).toBeInstanceOf(CosmeticResult);
            expect(Engine.prototype.getCosmeticResult).not.toHaveBeenCalled();
        });

        it('should return default CosmeticResult when engine is not started', () => {
            expect(engineApi.getCosmeticResult('https://example.com', {} as CosmeticOption)).toBeInstanceOf(CosmeticResult);
            expect(Engine.prototype.getCosmeticResult).not.toHaveBeenCalled();
        });
    });

    describe('getRulesCount method', () => {
        let getRulesCountSpy: MockInstance<typeof Engine.prototype.getRulesCount>;

        beforeEach(() => {
            getRulesCountSpy = vi.spyOn(Engine.prototype, 'getRulesCount');
        });

        afterEach(() => {
            getRulesCountSpy.mockClear();
        });

        it('should return tsurlfilter data when engine is started', async () => {
            await startEngine();
            setFilteringEnabled(true);

            engineApi.getRulesCount();

            expect(Engine.prototype.getRulesCount).toHaveBeenCalled();
        });

        it('should return 0 when engine is not started', () => {
            expect(engineApi.getRulesCount()).toBe(0);
            expect(Engine.prototype.getRulesCount).not.toHaveBeenCalled();
        });
    });
});
