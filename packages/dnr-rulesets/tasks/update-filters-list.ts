import { getRuleSetPath } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import fs from 'fs';

import { BrowserFilters, FILTERS_MARKDOWN_PATH } from '../common/constants';
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
        title: 'Opera MV3 filters',
        description: 'These filter lists are used in Opera MV3 browsers.',
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
 * Creates actual rulesets list and update existed FILTERS.md.
 *
 * @param sections Array of metadata sections to include in the filters list.
 *
 * TODO: generate docs in CI pipeline.
 */
async function updateFiltersList(sections: MetadataSection[]): Promise<void> {
    let headers = '';
    let desc = '';

    for (const section of sections) {
        const baseDir = `dist/filters/${section.browser}/declarative`;
        const sectionId = generateMarkdownAnchor(section.title);

        headers += `- [${section.title}](#${sectionId})\n`;
        desc += `## <a id="${sectionId}"></a> ${section.title}\n\n`;
        desc += `${section.description}\n\n`;

        for (const group of section.metadata.groups) {
            const groupId = `${sectionId}-${generateMarkdownAnchor(group.groupName)}`;
            const groupFilters = section.metadata.filters.filter((f) => f.groupId === group.groupId);

            headers += indentText(`- [${group.groupName}](#${groupId})\n`, 1);
            desc += `### <a id="${groupId}"></a> ${group.groupName}\n\n`;

            for (const filter of groupFilters) {
                const filterId = `${groupId}-${generateMarkdownAnchor(filter.name)}`;
                const filterPath = getRuleSetPath(filter.filterId, baseDir);

                headers += indentText(`- [${filter.name}](#${filterId})\n`, 2);
                desc += `#### <a id="${filterId}"></a> ${filter.name}\n\n`;
                desc += `${filter.description}\n\n`;
                desc += `- Filter ID: **${filter.filterId}**\n`;
                desc += `- Path: \`${filterPath}\`\n\n`;
            }
        }
    }

    const newFiltersList = `# Filters list\n\n${headers}\n\n${desc}`;

    await fs.promises.writeFile(FILTERS_MARKDOWN_PATH, newFiltersList);
}

getMetadataSections()
    .then(updateFiltersList)
    .catch(console.error);
