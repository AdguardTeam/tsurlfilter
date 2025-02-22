import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Configuration } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import packageJson from '../../package.json';
import { getIdFromFilterName } from '@adguard/tsurlfilter';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKGROUND_PATH = path.resolve(__dirname, '../../extension/pages/background');
const POPUP_PATH = path.join(__dirname, '../../extension/pages/popup');
const CONTENT_SCRIPT = path.join(__dirname, '../../extension/pages/content-script');
const ASSISTANT_INJECT = path.join(__dirname, '../../extension/pages/content-script/assistant-inject');
const GPC_SCRIPT = path.join(__dirname, '../../extension/pages/content-script/gpc');
const HIDE_DOCUMENT_REFERRER_SCRIPT = path.join(
    __dirname,
    '../../extension/pages/content-script/hide-document-referrer',
);
const BUILD_PATH = path.resolve(__dirname, '../../build');
const FILTERS_DIR = path.resolve(__dirname, '../../extension/filters');

const updateManifest = (content: Buffer) => {
    const manifest = JSON.parse(content.toString());

    manifest.version = packageJson.version;

    if (fs.existsSync(FILTERS_DIR)) {
        const nameList = fs.readdirSync(FILTERS_DIR);

        const rules = {
            rule_resources: nameList
                .map(getIdFromFilterName)
                .filter((rulesetIndex): rulesetIndex is number => rulesetIndex !== null && rulesetIndex !== undefined)
                .map((rulesetIndex: number) => {
                    const id = `ruleset_${rulesetIndex}`;

                    return {
                        id,
                        enabled: false,
                        path: `filters/declarative/${id}/${id}.json`,
                    };
                }),
        };

        manifest.declarative_net_request = rules;
    }

    return JSON.stringify(manifest, null, 4);
};

export const config: Configuration = {
    mode: 'development',
    devtool: 'source-map',
    optimization: {
        minimize: false,
    },
    entry: {
        background: BACKGROUND_PATH,
        'pages/popup': POPUP_PATH,
        'content-script': CONTENT_SCRIPT,
        'assistant-inject': ASSISTANT_INJECT,
        'gpc': GPC_SCRIPT,
        'hide-document-referrer': HIDE_DOCUMENT_REFERRER_SCRIPT,
    },
    output: {
        path: BUILD_PATH,
        filename: '[name].js',
        sourceMapFilename: '[name].js.map',
    },
    resolve: {
        extensions: ['.*', '.tsx', '.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.(js|ts)x?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'swc-loader',
                        options: {
                            env: {
                                targets: {
                                    chrome: 79,
                                    firefox: 78,
                                    opera: 66,
                                },
                            },
                        },
                    },
                ],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            template: path.join(POPUP_PATH, 'index.html'),
            filename: 'pages/popup.html',
            chunks: ['pages/popup'],
            cache: false,
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    context: 'extension',
                    from: '../scripts/manifest.json',
                    to: 'manifest.json',
                    transform: updateManifest,
                },
                {
                    context: 'extension',
                    from: 'filters',
                    to: 'filters',
                    noErrorOnMissing: true,
                },
            ],
        }),
    ],
};
