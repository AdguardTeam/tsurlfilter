import { type OutputBundle } from 'rollup';

/**
 * Fails the build if a build-time marker call survives into an emitted chunk.
 *
 * Both inliner plugins replace their marker call during `transform`. A marker
 * that reaches `generateBundle` means the module containing it was not
 * transformed, and the marker would be a free identifier at runtime. Vite dev
 * servers (Vitest) never call this hook, so this is a production-build-only
 * integrity net.
 *
 * @param pluginName Plugin name used as the error prefix.
 * @param markerName Marker identifier to look for in the emitted chunks.
 * @param bundle Emitted bundle passed to the `generateBundle` hook.
 *
 * @throws Error if any emitted chunk still contains `markerName`.
 */
export const assertNoMarkerInBundle = (
    pluginName: string,
    markerName: string,
    bundle: OutputBundle,
): void => {
    for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.code.includes(markerName)) {
            throw new Error(
                `[${pluginName}] Un-inlined ${markerName} marker in ${fileName}: `
                + 'the module containing the marker call was not transformed.',
            );
        }
    }
};
