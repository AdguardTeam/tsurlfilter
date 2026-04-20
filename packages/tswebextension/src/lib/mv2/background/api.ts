/**
 * @file Temporary entry point for global background submodule instances.
 * Needed for backward compatibility during internal API updates.
 * Will be removed in the future.
 */
import { defaultFilteringLog } from '../../common/filtering-log';

import { Allowlist } from './allowlist';
import { TsWebExtension } from './app';
import { appContext } from './app-context';
import { CosmeticFrameProcessor } from './cosmetic-frame-processor';
import { DocumentApi } from './document-api';
import { EngineApi } from './engine-api';
import { extSessionStorage } from './ext-session-storage';
import { MessagesApi } from './messages-api';
import { requestContextStorage } from './request';
import { ruleTextProvider } from './rule-text-provider-instance';
import { ContentFiltering } from './services/content-filtering/content-filtering';
import { CookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { CspService } from './services/csp-service';
import { DocumentBlockingService } from './services/document-blocking-service';
import { ParamsService } from './services/params-service';
import { PermissionsPolicyService } from './services/permissions-policy-service';
import { RedirectsService } from './services/redirects/redirects-service';
import { RemoveHeadersService } from './services/remove-headers-service';
import { ResourcesService } from './services/resources-service';
import { StealthApi } from './stealth-api';
import { TabsApi } from './tabs/tabs-api';
import { TabsCosmeticInjector } from './tabs/tabs-cosmetic-injector';

export const allowlist = new Allowlist();

// Use lazy RuleTextProvider to break circular dependency between StealthApi and EngineApi
export const stealthApi = new StealthApi(appContext, defaultFilteringLog, ruleTextProvider);

export const engineApi = new EngineApi(allowlist, appContext, stealthApi);

// Initialize the lazy provider with the actual EngineApi instance
ruleTextProvider.initialize(engineApi);

export const documentApi = new DocumentApi(allowlist, engineApi);

export const tabsApi = new TabsApi(documentApi);

export const cosmeticFrameProcessor = new CosmeticFrameProcessor(engineApi, tabsApi);

export const documentBlockingService = new DocumentBlockingService(tabsApi, engineApi);

export const messagesApi = new MessagesApi(tabsApi, defaultFilteringLog);

export const resourcesService = new ResourcesService(() => {
    return Math.floor(Math.random() * 982451653 + 982451653).toString(36);
});

export const redirectsService = new RedirectsService(resourcesService);

export const paramsService = new ParamsService(defaultFilteringLog, engineApi);

export const cspService = new CspService(defaultFilteringLog, engineApi);

export const removeHeadersService = new RemoveHeadersService(defaultFilteringLog, engineApi);

export const permissionsPolicyService = new PermissionsPolicyService(
    requestContextStorage,
    defaultFilteringLog,
    engineApi,
);

export const cookieFiltering = new CookieFiltering(defaultFilteringLog, engineApi, tabsApi);

export const contentFiltering = new ContentFiltering(engineApi);

/**
 * Creates new instance of {@link TsWebExtension}.
 *
 * @param webAccessibleResourcesPath Path to web accessible resources for {@link resourcesService}.
 *
 * @returns New instance of {@link TsWebExtension}.
 */
export function createTsWebExtension(webAccessibleResourcesPath: string): TsWebExtension {
    resourcesService.init(webAccessibleResourcesPath);

    const tabCosmeticInjector = new TabsCosmeticInjector(
        documentApi,
        tabsApi,
        engineApi,
    );

    return new TsWebExtension(
        appContext,
        tabsApi,
        engineApi,
        stealthApi,
        messagesApi,
        tabCosmeticInjector,
        redirectsService,
        documentBlockingService,
        defaultFilteringLog,
        extSessionStorage,
    );
}
