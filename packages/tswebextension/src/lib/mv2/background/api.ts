/**
 * @file Temporary entry point for global background submodule instances.
 * Needed for backward compatibility during internal API updates.
 * Will be removed in the future.
 */
import { Allowlist } from './allowlist';
import { EngineApi } from './engine-api';
import { DocumentApi } from './document-api';
import { TabsApi } from './tabs/tabs-api';
import { MessagesApi } from './messages-api';
import { TabsCosmeticInjector } from './tabs/tabs-cosmetic-injector';
import { stealthApi } from './stealth-api';
import { appContext } from './context';
import { TsWebExtension } from './app';
import { ResourcesService } from './services/resources-service';
import { RedirectsService } from './services/redirects/redirects-service';
import { DocumentBlockingService } from './services/document-blocking-service';
import { defaultFilteringLog } from '../../common/filtering-log';
import { extSessionStorage } from './ext-session-storage';

export const allowlist = new Allowlist();

export const engineApi = new EngineApi(allowlist, appContext, stealthApi);

export const documentApi = new DocumentApi(allowlist, engineApi);

export const tabsApi = new TabsApi(documentApi);

export const documentBlockingService = new DocumentBlockingService(tabsApi);

export const messagesApi = new MessagesApi(tabsApi, defaultFilteringLog);

export const resourcesService = new ResourcesService(() => {
    return Math.floor(Math.random() * 982451653 + 982451653).toString(36);
});

export const redirectsService = new RedirectsService(resourcesService);

/**
 * Creates new instance of {@link TsWebExtension}.
 * @param webAccessibleResourcesPath Path to web accessible resources for {@link resourcesService}.
 * @returns New instance of {@link TsWebExtension}.
 */
export function createTsWebExtension(webAccessibleResourcesPath: string): TsWebExtension {
    resourcesService.init(webAccessibleResourcesPath);

    const tabCosmeticInjector = new TabsCosmeticInjector(
        engineApi,
        documentApi,
        tabsApi,
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
