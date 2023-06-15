/**
 * @file Temporary entry point for global background submodule instances.
 * Needed for backward compatibility during internal API updates.
 * Will be removed in the future.
 */
import { Allowlist } from './allowlist';
import { EngineApi } from './engine-api';
import { DocumentApi } from './document-api';
import { TabsApi } from './tabs/tabs-api';
import { stealthApi } from './stealth-api';
import { appContext } from './context';

export const allowlist = new Allowlist();

export const engineApi = new EngineApi(allowlist, appContext, stealthApi);

export const documentApi = new DocumentApi(allowlist, engineApi);

export const tabsApi = new TabsApi(documentApi);
