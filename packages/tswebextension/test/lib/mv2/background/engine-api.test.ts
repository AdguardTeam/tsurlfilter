import {
    describe,
    expect,
    beforeAll,
    beforeEach,
    afterAll,
    afterEach,
    it,
    vi,
} from 'vitest';
import browser from 'sinon-chrome';
import { type CosmeticOption, Engine, CosmeticResult } from '@adguard/tsurlfilter';

import { type MatchQuery } from '../../../../src/lib/common/interfaces';
import { EngineApi } from '../../../../src/lib/mv2/background/engine-api';
import { Allowlist } from '../../../../src/lib/mv2/background/allowlist';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { stealthApi } from '../../../../src/lib/mv2/background/stealth-api';

import { getConfigurationMv2Fixture } from './fixtures/configuration';

vi.mock('@adguard/tsurlfilter');
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
        vi.clearAllMocks();
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
            const configuration = getConfigurationMv2Fixture();

            engineApi.startEngine(configuration);

            expect(Engine.prototype.loadRulesAsync).toHaveBeenCalled();
        });
    });

    describe('matchRequest method', () => {
        it('should return tsurlfilter data when engine is started', async () => {
            await startEngine();
            setFilteringEnabled(true);

            engineApi.matchRequest({} as MatchQuery);

            expect(Engine.prototype.matchRequest).toHaveBeenCalled();
        });

        it('should return null when filtering is disabled', async () => {
            await startEngine();
            setFilteringEnabled(false);

            expect(engineApi.matchRequest({} as MatchQuery)).toBeNull();
            expect(Engine.prototype.matchRequest).not.toHaveBeenCalled();
        });

        it('should return null when engine is not started', () => {
            expect(engineApi.matchRequest({} as MatchQuery)).toBeNull();
            expect(Engine.prototype.matchRequest).not.toHaveBeenCalled();
        });
    });

    describe('matchFrame method', () => {
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
