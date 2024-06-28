import fs from 'fs';
import { README_PATH } from './constants';
import{ type Metadata, getMetadata } from './metadata';

/**
 * Creates actual rulesets list and update existed README.md.
 * @param metadata Filters metadata downloaded from {@link FILTERS_METADATA_URL}
 * 
 * TODO (v.zhelvis): generate docs in CI pipeline.
 */
async function updateReadme(metadata: Metadata): Promise<void> {
    const readme = await fs.promises.readFile(README_PATH, { encoding: 'utf-8' });

    const title = '## Included filter lists\n';
    const nextTitle = '## Development\n'

    const start = readme.indexOf(title) + title.length + 1;
    const end = readme.indexOf(nextTitle);

    let desc = '';

    for (let group of metadata.groups) {
        desc += `### ${group.groupName}\n\n`;

        const groupFilters = metadata.filters.filter((f) => f.groupId === group.groupId);

        for (let filter of groupFilters) {
            desc += `#### ${filter.name}\n\n`;
            desc += `${filter.description}\n\n`;
            desc += `* Filter ID: **${filter.filterId}**\n`;
            desc += `* Path: \`<filters-directory>/declarative/ruleset_${filter.filterId}/ruleset_${filter.filterId}.json\`\n\n`;
        }
    }

    const newReadme = readme.slice(0, start) + desc + readme.slice(end);

    await fs.promises.writeFile(README_PATH, newReadme);
}

getMetadata()
    .then(updateReadme)
    .catch(console.error);