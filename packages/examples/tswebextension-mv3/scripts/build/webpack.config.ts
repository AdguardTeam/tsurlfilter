import path from 'path';
import fs from 'fs';
import { Configuration } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import packageJson from '../../package.json';

const BACKGROUND_PATH = path.resolve(__dirname, '../../extension/pages/background');
const POPUP_PATH = path.join(__dirname, '../../extension/pages/popup');
const DOCUMENT_BLOCKING_PATH = path.join(__dirname, '../../extension/pages/document-blocking');
const CONTENT_SCRIPT = path.join(__dirname, '../../extension/pages/content-script');
const BUILD_PATH = path.resolve(__dirname, '../../build');
const FILTERS_DIR = path.resolve(__dirname, '../../extension/filters');
const DEVTOOLS_PATH = path.resolve(__dirname, '../../extension/src/devtools');
const DEBUGGING_PATH = path.resolve(__dirname, '../../extension/src/debugging');

const updateManifest = (content: Buffer) => {
    const manifest = JSON.parse(content.toString());

    manifest.version = packageJson.version;

    if (fs.existsSync(FILTERS_DIR)) {
        const nameList = fs.readdirSync(FILTERS_DIR);

        const rules = {
            rule_resources: nameList
                .map((name: string) => {
                    const rulesetIndex = name.match(/\d+/);
                    return rulesetIndex ? rulesetIndex[0] : null;
                })
                .filter((rulesetIndex): rulesetIndex is string => rulesetIndex !== null && rulesetIndex !== undefined)
                .map((rulesetIndex: string) => {
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
        devtools: DEVTOOLS_PATH,
        debugging: DEBUGGING_PATH,
    },
    output: {
        path: BUILD_PATH,
        filename: '[name].js',
        sourceMapFilename: '[name].js.map',
    },
    resolve: {
        extensions: ['*', '.tsx', '.ts', '.js'],
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
        new HtmlWebpackPlugin({
            template: path.join(DOCUMENT_BLOCKING_PATH, 'index.html'),
            filename: 'pages/document-blocking.html',
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.join(DEVTOOLS_PATH, 'index.html'),
            filename: 'devtools.html',
            chunks: ['devtools'],
        }),
        new HtmlWebpackPlugin({
            template: path.join(DEBUGGING_PATH, 'index.html'),
            filename: 'debugging.html',
            chunks: ['debugging'],
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
