import path from 'path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';

const BACKGROUND_PATH = path.resolve(__dirname, '../../extension/pages/background');
const CONTENT_SCRIPT = path.resolve(__dirname, '../../extension/pages/content-script');
const BUILD_PATH = path.resolve(__dirname, '../../build');

export const config = {
    mode: 'development',
    devtool: false,
    entry: {
        background: BACKGROUND_PATH,
        'content-script': CONTENT_SCRIPT,
    },
    output: {
        path: BUILD_PATH,
        filename: '[name].js',
    },
    resolve: {
        extensions: ['*', '.js'],
        modules: [path.resolve(__dirname, '../../node_modules')],
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'babel-loader',
                    options: { babelrc: true },
                }],
            },
        ],
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                {
                    context: 'extension',
                    from: 'manifest.json',
                    to: 'manifest.json',
                },
                {
                    context: 'extension',
                    from: 'assets',
                    to: 'assets',
                },
                {
                    context: 'extension',
                    from: 'filters',
                    to: 'filters',
                },
                {
                    context: 'extension',
                    from: '_locales',
                    to: '_locales',
                },
            ],
        }),
    ],
};
