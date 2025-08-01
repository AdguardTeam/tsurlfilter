import fs from 'fs';

import { BrowserFilters, QUICK_FIXES_FILTER_ID, README_PATH } from '../common/constants';
import { downloadMetadata, type Metadata } from '../common/metadata';

/**
 * Metadata section for browser.
 */
interface MetadataSection {
    /**
     * Title of the section.
     */
    title: string;

    /**
     * Description of the section.
     */
    description: string;

    /**
     * Section metadata.
     */
    metadata: Metadata;
}

const SECTION_TEXTS: Record<BrowserFilters, Omit<MetadataSection, 'metadata'>> = {
    [BrowserFilters.ChromiumMV3]: {
        title: 'Chromium MV3 filters',
        description: 'These filter lists are used in Chromium MV3 browsers.',
    },
    [BrowserFilters.Opera]: {
        title: 'Opera filters',
        description: 'These filter lists are used in Opera browser.',
    },
};

/**
 * Downloads metadata for all browsers and returns an array of metadata sections.
 *
 * @returns Array of metadata for each browser (including "Common").
 */
async function getMetadataSections(): Promise<MetadataSection[]> {
    return Promise.all(
        Object.values(BrowserFilters).map(async (browser) => {
            const metadata = await downloadMetadata(undefined, browser);
            return {
                ...SECTION_TEXTS[browser],
                metadata,
            };
        }),
    );
}

/**
 * Creates actual rulesets list and update existed README.md.
 *
 * @param sections Array of metadata sections to include in the README.
 *
 * TODO (v.zhelvis): generate docs in CI pipeline.
 */
async function updateReadme(sections: MetadataSection[]): Promise<void> {
    const readme = await fs.promises.readFile(README_PATH, { encoding: 'utf-8' });

    const title = '## Included filter lists\n';
    const nextTitle = '## Development\n';

    const start = readme.indexOf(title) + title.length + 1;
    const end = readme.indexOf(nextTitle);

    let desc = '';

    for (const section of sections) {
        desc += `### ${section.title}\n\n`;
        desc += `${section.description}\n\n`;

        for (const group of section.metadata.groups) {
            desc += `#### ${group.groupName}\n\n`;

            const groupFilters = section.metadata.filters.filter((f) => f.groupId === group.groupId);

            for (const filter of groupFilters) {
                desc += `##### ${filter.name}\n\n`;
                if (filter.filterId === QUICK_FIXES_FILTER_ID) {
                    // eslint-disable-next-line max-len
                    desc += `**IMPORTANT:** This filter is not convertible (excluded from build), but it is still included in the metadata. It should be downloaded from the server on the client and applied dynamically.\n\n`;
                }
                desc += `${filter.description}\n\n`;
                desc += `- Filter ID: **${filter.filterId}**\n`;
                if (filter.filterId === QUICK_FIXES_FILTER_ID) {
                    desc += `\n`;
                    continue;
                }
                // eslint-disable-next-line max-len
                desc += `- Path: \`<filters-directory>/declarative/ruleset_${filter.filterId}/ruleset_${filter.filterId}.json\`\n\n`;
            }
        }
    }

    const newReadme = readme.slice(0, start) + desc + readme.slice(end);

    await fs.promises.writeFile(README_PATH, newReadme);
}

getMetadataSections()
    .then(updateReadme)
    .catch(console.error);
