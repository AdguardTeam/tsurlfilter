/**
 * @file Temporary entry point for global background submodule instances.
 * Needed for backward compatibility during internal API updates.
 * Will be removed in the future.
 */
import { allowlistApi } from './allowlist';
import { TabsApi } from './tabs';

export const tabsApi = new TabsApi(allowlistApi);
