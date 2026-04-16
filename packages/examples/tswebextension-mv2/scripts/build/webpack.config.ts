import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { Configuration } from 'webpack';

import { BuildOutput } from '../../constants';
import {
    ASSISTANT_INJECT_PATH,
    BACKGROUND_PATH,
    BUILD_PATH,
    CONTENT_SCRIPT_PATH,
    DOCUMENT_BLOCKING_PATH,
    POPUP_PATH,
} from '../constants';


const isFFBuild = process.env.BROWSER === 'firefox';

export const config: Configuration = {
    mode: 'development',
    devtool: 'eval-source-map',
    entry: {
        [BuildOutput.Background]: BACKGROUND_PATH,
        [BuildOutput.ContentScript]: CONTENT_SCRIPT_PATH,
        [BuildOutput.AssistantInject]: ASSISTANT_INJECT_PATH,
        [BuildOutput.Popup]: POPUP_PATH,
    },
    output: {
        path: BUILD_PATH,
        filename: '[name].js',
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
            template: path.join(BACKGROUND_PATH, 'index.html'),
            filename: `${BuildOutput.Background}.html`,
            chunks: [BuildOutput.Background],
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.join(POPUP_PATH, 'index.html'),
            filename: `${BuildOutput.Popup}.html`,
            chunks: [BuildOutput.Popup],
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.join(DOCUMENT_BLOCKING_PATH, 'index.html'),
            filename: `${BuildOutput.DocumentBlocking}.html`,
            cache: false,
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    context: 'extension',
                    from: isFFBuild ? 'manifest.firefox.json' : 'manifest.chrome.json',
                    to: 'manifest.json',
                },
            ],
        }),
    ],
};
