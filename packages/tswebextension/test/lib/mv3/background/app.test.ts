import {
    describe,
    expect,
    beforeEach,
    it,
    vi,
} from 'vitest';

import { TsWebExtension } from '../../../../src/lib/mv3/background/app';
import { CspService } from '../../../../src/lib/mv3/background/services/csp-service';
import { SessionRulesApi } from '../../../../src/lib/mv3/background/session-rules-api';

// Mock CspService
vi.mock('../../../../src/lib/mv3/background/services/csp-service', () => ({
    CspService: {
        init: vi.fn(),
    },
}));

// Mock SessionRulesApi
vi.mock('../../../../src/lib/mv3/background/session-rules-api', () => ({
    SessionRulesApi: {
        removeAllSessionRules: vi.fn(),
        updateSessionRules: vi.fn(),
    },
    SessionRuleId: {
        CSPReportBlocking: 5,
    },
}));

// Mock other dependencies
vi.mock('../../../../src/lib/mv3/background/declarative-filtering-log', () => ({
    declarativeFilteringLog: {
        stop: vi.fn(),
        startUpdate: vi.fn(),
        finishUpdate: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/stealth-service', () => ({
    StealthService: {
        applySettings: vi.fn().mockResolvedValue({}),
        clearAll: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/dynamic-rules-api', () => ({
    DynamicRulesApi: {
        updateDynamicFiltering: vi.fn().mockResolvedValue({
            declarativeRulesToCancel: [],
        }),
        removeAllRules: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/filters-api', () => ({
    FiltersApi: {
        updateFiltering: vi.fn().mockResolvedValue([]),
        getEnabledRuleSets: vi.fn().mockResolvedValue([]),
        loadFilterContent: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        startEngine: vi.fn().mockResolvedValue({}),
        stopEngine: vi.fn(),
        waitingForEngine: Promise.resolve(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/allowlist-api', () => ({
    allowlistApi: {
        configure: vi.fn(),
        combineAllowListRulesForDNR: vi.fn().mockReturnValue(''),
        getAllowlistRules: vi.fn().mockReturnValue(null),
    },
    AllowlistApi: {
        getAllowlistRule: vi.fn().mockReturnValue(''),
    },
}));

vi.mock('../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        updateCurrentTabsMainFrameRules: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/web-request-api', () => ({
    WebRequestApi: {
        flushMemoryCache: vi.fn(),
        stop: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/document-blocking-service', () => ({
    documentBlockingService: {
        configure: vi.fn(),
    },
}));

// Mock browser API
const mockBrowser = {
    declarativeNetRequest: {
        getEnabledRulesets: vi.fn().mockResolvedValue([]),
    },
};

// @ts-expect-error - Mock for testing
global.browser = mockBrowser;

describe('TsWebExtension - CSP Service Integration', () => {
    let tsWebExtension: TsWebExtension;

    beforeEach(() => {
        vi.clearAllMocks();
        tsWebExtension = new TsWebExtension();
    });

    describe('when filtering is enabled', () => {
        it('should initialize CSP service', async () => {
            const configuration = {
                settings: {
                    filteringEnabled: true,
                },
                allowlist: [],
                trustedDomains: [],
                userrules: { content: '' },
                verbose: false,
                declarativeLogEnabled: false,
                ruleSetsPath: '',
            } as any;

            await tsWebExtension.configure(configuration);

            // Should initialize CSP service when filtering is enabled
            expect(vi.mocked(CspService.init)).toHaveBeenCalled();
        });
    });

    describe('when filtering is disabled', () => {
        it('should not initialize CSP service and remove all session rules', async () => {
            const configuration = {
                settings: {
                    filteringEnabled: false,
                },
                allowlist: [],
                trustedDomains: [],
                userrules: { content: '' },
                verbose: false,
                declarativeLogEnabled: false,
                ruleSetsPath: '',
            } as any;

            await tsWebExtension.configure(configuration);

            // Should NOT initialize CSP service when filtering is disabled
            expect(vi.mocked(CspService.init)).not.toHaveBeenCalled();
            
            // Should remove all session rules (including CSP blocking rule)
            expect(vi.mocked(SessionRulesApi.removeAllSessionRules)).toHaveBeenCalled();
        });
    });
});
