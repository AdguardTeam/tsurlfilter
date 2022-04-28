import fs from 'fs';
import * as TSUrlFilter from '@adguard/tsurlfilter';
import axios from 'axios';
import path from 'path';

const COMMON_FILTERS_DIR = './extension/filters';
const FILTERS_DIR = `${COMMON_FILTERS_DIR}`;
const DECLARATIVE_FILTERS_DIR = `${COMMON_FILTERS_DIR}/declarative`;

const ADGUARD_FILTERS_IDS = [1, 2, 3, 4, 9, 14];

const EXTENSION_FILTERS_SERVER_URL_FORMAT = 'https://filters.adtidy.org/extension/chromium';
const FILTER_DOWNLOAD_URL_FORMAT = `${EXTENSION_FILTERS_SERVER_URL_FORMAT}/filters/%filter.txt`;

export type UrlType = {
    id: number,
    url: string,
    file: string,
};

const getUrlsOfFiltersResources = () => {
    return ADGUARD_FILTERS_IDS.map(filterId => ({
        id: filterId,
        url: FILTER_DOWNLOAD_URL_FORMAT
            .replace('%filter', `${filterId}`),
        file: `filter_${filterId}.txt`,
    }));
};

const ensureDirSync = (dirPath: string) => {
    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, {
            recursive: true,
            mode: 0o2775,
        });
    }
};

const startConvert = () => {
    const converter = new TSUrlFilter.DeclarativeConverter();

    ensureDirSync(DECLARATIVE_FILTERS_DIR);

    const files = fs.readdirSync(FILTERS_DIR);

    const prepareDeclarativeFilter = (filePath: string) => {
        console.info(`Convert ${filePath}...`);

        const rulesetIndex = filePath.match(/\d+/);
        if (rulesetIndex) {
            const data = fs.readFileSync(`${FILTERS_DIR}/${filePath}`, { encoding: 'utf-8' });
            const list = new TSUrlFilter.StringRuleList(
                +rulesetIndex, data, false,
            );
            const result = converter.convert(list, {
                resoursesPath: '/war/redirects',
            });

            const fileDeclarative = filePath.replace('.txt', '.json');
            fs.writeFileSync(
                `${DECLARATIVE_FILTERS_DIR}/${fileDeclarative}`,
                JSON.stringify(result, null, '\t'),
            );

            console.info(`Convert ${filePath} done`);
        } else {
            console.info(`Convert ${filePath} skipped`);
        }
    };

    files.forEach(prepareDeclarativeFilter);
};

const downloadFilter = async (url: UrlType, filtersDir: string) => {
    console.info(`Download ${url.url}...`);

    const response = await axios.get(url.url, { responseType: 'arraybuffer' });

    await fs.promises.writeFile(path.join(filtersDir, url.file), response.data);

    console.info(`Download ${url.url} done`);
};

const startDownload = async () => {
    ensureDirSync(FILTERS_DIR);

    const urls = getUrlsOfFiltersResources();
    await Promise.all(urls.map(url => downloadFilter(url, FILTERS_DIR)));
};

/**
 * Compiles rules to declarative json
 * Actually for each ruleset entry in manifest's declarative_net_request:
 *
 * "declarative_net_request": {
 *   "rule_resources": [{
 *     "id": "ruleset_1",
 *     "enabled": true,
 *     "path": "filters/declarative/rules.json"
 *   }]
 * }
 *
 * we should find corresponding text file in resources, and then convert and save json to path specified in the manifest
 */
const precompileRules = async () => {
    await startDownload();
    startConvert();
};

precompileRules();
