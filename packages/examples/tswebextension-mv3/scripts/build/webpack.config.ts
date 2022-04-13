import path from 'path';
import fs from 'fs';
import { Configuration } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import packageJson from '../../package.json';

const BACKGROUND_PATH = path.resolve(__dirname, '../../extension/pages/background');
const POPUP_PATH = path.join(__dirname, '../../extension/pages/popup');
const CONTENT_SCRIPT = path.join(__dirname, '../../extension/pages/content-script');
const BUILD_PATH = path.resolve(__dirname, '../../build');
const DECLARATIVE_FILTERS_DIR = path.resolve(__dirname, '../../extension/filters/declarative');

const updateManifest = (content: Buffer) => {
    const manifest = JSON.parse(content.toString());

    manifest.version = packageJson.version;

    if (fs.existsSync(DECLARATIVE_FILTERS_DIR)) {
        const nameList = fs.readdirSync(DECLARATIVE_FILTERS_DIR);

        const rules = {
            rule_resources: nameList.map((name: string) => {
                const rulesetIndex = name.match(/\d+/);
                return {
                    id: `ruleset_${rulesetIndex}`,
                    enabled: false,
                    path: `filters/declarative/${name}`,
                };
            }),
        };

        manifest.declarative_net_request = rules;
    }

    return JSON.stringify(manifest, null, 4);
};

export const config: Configuration = {
    mode: 'development',
    devtool: false,
    optimization: {
        minimize: false,
    },
    entry: {
        background: BACKGROUND_PATH,
        'pages/popup': POPUP_PATH,
        'content-script': CONTENT_SCRIPT,
    },
    output: {
        path: BUILD_PATH,
        filename: '[name].js',
    },
    resolve: {
        extensions: ['*', '.tsx', '.ts', '.js'],
        fallback: {
            url: false,
            path: false,
            fs: false,
        },
    },
    module: {
        rules: [
            {
                test: /\.(js|ts)x?$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'babel-loader',
                    options: { babelrc: true },
                }],
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
                },
            ],
        }),
    ],
};
