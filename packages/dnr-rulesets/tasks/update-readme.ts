import fs from 'fs';

import { QUICK_FIXES_FILTER_ID, README_PATH } from '../common/constants';
import { downloadMetadata, type Metadata } from '../common/metadata';

/**
 * Creates actual rulesets list and update existed README.md.
 *
 * @param metadata Filters metadata downloaded from `FILTERS_METADATA_URL`.
 *
 * TODO (v.zhelvis): generate docs in CI pipeline.
 */
async function updateReadme(metadata: Metadata): Promise<void> {
    const readme = await fs.promises.readFile(README_PATH, { encoding: 'utf-8' });

    const title = '## Included filter lists\n';
    const nextTitle = '## Development\n';

    const start = readme.indexOf(title) + title.length + 1;
    const end = readme.indexOf(nextTitle);

    let desc = '';

    for (const group of metadata.groups) {
        desc += `### ${group.groupName}\n\n`;

        const groupFilters = metadata.filters.filter((f) => f.groupId === group.groupId);

        for (const filter of groupFilters) {
            desc += `#### ${filter.name}\n\n`;
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

    const newReadme = readme.slice(0, start) + desc + readme.slice(end);

    await fs.promises.writeFile(README_PATH, newReadme);
}

downloadMetadata()
    .then(updateReadme)
    .catch(console.error);
