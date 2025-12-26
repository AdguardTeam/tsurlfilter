import path from 'path';
import { createRequire } from 'module';
import { Configuration } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import {
    BACKGROUND_PATH,
    CONTENT_SCRIPT,
    POPUP_PATH,
    BLOCKING_PAGE_PATH,
    BUILD_PATH,
    ASSISTANT_INJECT,
} from '../constants';

const require = createRequire(import.meta.url);

const resolveModulePath = (moduleName: string) => {
    return require.resolve(moduleName);
};

export const config: Configuration = {
    mode: 'production',
    entry: {
        background: BACKGROUND_PATH,
        'content-script': CONTENT_SCRIPT,
        'adguard-assistant': ASSISTANT_INJECT,
        popup: POPUP_PATH,
    },
    output: {
        path: BUILD_PATH,
        filename: '[name].js',
    },
    resolve: {
        extensions: ['*', '.ts', '.js'],
        fallback: {
            crypto: resolveModulePath('crypto-browserify'),
            stream: resolveModulePath('stream-browserify'),
            vm: resolveModulePath('vm-browserify'),
        },
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
                                    chrome: 84,
                                },
                            },
                        },
                    },
                ],
                resolve: {
                    fullySpecified: false,
                },
            },
        ],
    },
    optimization: {
        minimize: false,
    },
    plugins: [
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            template: path.join(BACKGROUND_PATH, 'index.html'),
            filename: 'background.html',
            chunks: ['background'],
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.join(POPUP_PATH, 'index.html'),
            filename: 'popup.html',
            chunks: ['popup'],
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.join(BLOCKING_PAGE_PATH, 'index.html'),
            filename: 'blocking-page.html',
            chunks: ['blocking-page'],
            cache: false,
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    context: 'extension',
                    from: 'manifest.json',
                    to: 'manifest.json',
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
