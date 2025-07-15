/* eslint-disable no-console */
import { Application, OptionDefaults, TypeDocReader } from 'typedoc';

/**
 * Function to launch typedoc programmatically.
 * Because using ts files as config is not possible for typedoc.
 */
async function main() {
    const app = await Application.bootstrapWithPlugins({
        entryPoints: ['src/index.ts'],
        out: 'docs',
        entryPointStrategy: 'expand',
        excludeExternals: false,
        excludePrivate: true,
        excludeProtected: true,
        categorizeByGroup: true,
        sort: ['source-order'],
        readme: 'README.md',
        hideGenerator: true,
        includeVersion: true,
        sourceLinkTemplate: 'https://github.com/AdguardTeam/tsurlfilter/blob/{gitRevision}/{path}#L{line}',
        ignoredHighlightLanguages: ['adblock'],
        tsconfig: 'tsconfig.json',
        inlineTags: [...OptionDefaults.inlineTags, '@link', '@note'],
        blockTags: [...OptionDefaults.blockTags, '@todo', '@file', '@note'],

        // Skip TypeScript errors during documentation generation
        skipErrorChecking: true,
    }, [new TypeDocReader()]);

    // Generate documentation
    const project = await app.convert();

    // If conversion was successful, generate docs
    if (project) {
        await app.generateOutputs(project);
        console.log('Documentation generated successfully.');
    } else {
        console.error('Failed to generate documentation.');
    }
}

main();
