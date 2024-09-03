import type { NxPluginV1 } from '../../utils/nx-plugin.deprecated';
import type { CreateNodesResultWithContext, LoadedNxPlugin, NormalizedPlugin } from './internal-api';
import { type CreateNodesContext, type NxPlugin, type NxPluginV2 } from './public-api';
export declare function isNxPluginV2(plugin: NxPlugin): plugin is NxPluginV2;
export declare function isNxPluginV1(plugin: NxPlugin | LoadedNxPlugin): plugin is NxPluginV1;
export declare function normalizeNxPlugin(plugin: NxPlugin): NormalizedPlugin;
export declare function runCreateNodesInParallel(configFiles: readonly string[], plugin: NormalizedPlugin, options: unknown, context: CreateNodesContext): Promise<CreateNodesResultWithContext[]>;
