import fs from 'fs';

import { BrowserFilters, QUICK_FIXES_FILTER_ID, README_PATH } from '../common/constants';
import { downloadMetadata, type Metadata } from '../common/metadata';

/**
 * Generates a markdown anchor ID for a given title.
 *
 * @param title Title to generate an anchor for.
 *
 * @returns Markdown anchor ID.
 */
function generateMarkdownAnchor(title: string): string {
    return title
        .trim() // Remove leading/trailing whitespace
        .toLowerCase() // Convert to lowercase
        .replace(/[^\w\s-]/g, '') // Remove non-word characters (punctuation, etc.)
        .replace(/\s+/g, '-'); // Replace spaces with hyphens
}

/**
 * Indents text by a specified number of levels.
 *
 * @param text Text to indent.
 * @param level Number of levels to indent (each level is 4 spaces).
 *
 * @returns Indented text.
 */
function indentText(text: string, level: number): string {
    const indent = ' '.repeat(level * 4); // 4 spaces per level
    return indent + text;
}

/**
 * Metadata section for browser.
 */
interface MetadataSection {
    /**
     * Browser for which the metadata is applicable.
     */
    browser: BrowserFilters;

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

const SECTION_TEXTS: Record<BrowserFilters, Pick<MetadataSection, 'title' | 'description'>> = {
    [BrowserFilters.ChromiumMv3]: {
        title: 'Chromium MV3 filters',
        description: 'These filter lists are used in Chromium MV3 browsers.',
    },
    [BrowserFilters.OperaMv3]: {
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
                browser,
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
 * TODO: generate docs in CI pipeline.
 */
async function updateReadme(sections: MetadataSection[]): Promise<void> {
    const readme = await fs.promises.readFile(README_PATH, { encoding: 'utf-8' });

    let headers = '';
    let desc = '';

    for (const section of sections) {
        headers += indentText(`- [${section.title}](#${generateMarkdownAnchor(section.title)})\n`, 2);
        desc += `### ${section.title}\n\n`;
        desc += `${section.description}\n\n`;

        for (const group of section.metadata.groups) {
            headers += indentText(`- [${group.groupName}](#${generateMarkdownAnchor(group.groupName)})\n`, 3);
            desc += `#### ${group.groupName}\n\n`;

            const groupFilters = section.metadata.filters.filter((f) => f.groupId === group.groupId);

            for (const filter of groupFilters) {
                headers += indentText(`- [${filter.name}](#${generateMarkdownAnchor(filter.name)})\n`, 4);
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
                desc += `- Path: \`dist/filters/${section.browser}/declarative/ruleset_${filter.filterId}/ruleset_${filter.filterId}.json\`\n\n`;
            }
        }
    }

    let newReadme = readme;

    const header = indentText('- [Included filter lists](#included-filter-lists)\n', 1);
    const nextHeader = indentText('- [Development](#development)\n', 1);

    const headersStart = newReadme.indexOf(header) + header.length + 1;
    const headersEnd = newReadme.indexOf(nextHeader);

    newReadme = newReadme.slice(0, headersStart) + headers + newReadme.slice(headersEnd);

    const title = '## Included filter lists\n';
    const nextTitle = '## Development\n';

    const sectionsStart = newReadme.indexOf(title) + title.length + 1;
    const sectionsEnd = newReadme.indexOf(nextTitle);

    newReadme = newReadme.slice(0, sectionsStart) + desc + newReadme.slice(sectionsEnd);

    await fs.promises.writeFile(README_PATH, newReadme);
}

getMetadataSections()
    .then(updateReadme)
    .catch(console.error);
