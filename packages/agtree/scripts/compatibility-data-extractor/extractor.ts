import * as fs from 'fs/promises';
import * as path from 'path';

import { cloneRepositories, scriptletsUrls } from './downloader';
import { extractAbpScriptlets } from './extractors/abp-scriptlets';
import { extractAdgScriptlets } from './extractors/adg-scriptlets';
import { extractUboScriptlets } from './extractors/ubo-scriptlets';

const RESULTS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'results');
const SCRIPTLETS_DIR = path.join(RESULTS_DIR, 'scriptlets');

/**
 * Extracts scriptlets from all sources.
 */
async function extractScriptlets(): Promise<void> {
    console.log('\n=== Extracting Scriptlets ===\n');

    await fs.mkdir(SCRIPTLETS_DIR, { recursive: true });

    // Extract ABP scriptlets
    const abpScriptlets = await extractAbpScriptlets();
    await fs.writeFile(
        path.join(SCRIPTLETS_DIR, 'abp.json'),
        JSON.stringify(abpScriptlets, null, 2),
        'utf-8',
    );
    console.log('✓ ABP scriptlets written to results/scriptlets/abp.json');

    // Extract AdGuard scriptlets
    const adgScriptlets = await extractAdgScriptlets();
    await fs.writeFile(
        path.join(SCRIPTLETS_DIR, 'adg.json'),
        JSON.stringify(adgScriptlets, null, 2),
        'utf-8',
    );
    console.log('✓ AdGuard scriptlets written to results/scriptlets/adg.json');

    // Extract uBlock Origin scriptlets
    const uboScriptlets = await extractUboScriptlets();
    await fs.writeFile(
        path.join(SCRIPTLETS_DIR, 'ubo.json'),
        JSON.stringify(uboScriptlets, null, 2),
        'utf-8',
    );
    console.log('✓ uBlock Origin scriptlets written to results/scriptlets/ubo.json');
}

/**
 * Main extraction function.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    // Parse command line arguments
    const shouldExtractScriptlets = args.includes('--scriptlets');
    const shouldClone = args.includes('--clone');

    // If no specific extraction is requested, show usage
    if (!shouldExtractScriptlets) {
        console.log('Usage: npx tsx extractor.ts [options]');
        console.log('\nOptions:');
        console.log('  --scriptlets    Extract scriptlets from ABP, AdGuard, and uBlock');
        console.log('  --clone         Clone/update repositories before extraction');
        console.log('\nExample:');
        console.log('  npx tsx extractor.ts --clone --scriptlets');
        process.exit(0);
    }

    // Clone repositories if requested
    if (shouldClone) {
        console.log('\n=== Cloning Repositories ===\n');
        await cloneRepositories(scriptletsUrls);
    }

    // Run requested extractions
    if (shouldExtractScriptlets) {
        await extractScriptlets();
    }

    console.log('\n✓ All extractions completed!');
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
