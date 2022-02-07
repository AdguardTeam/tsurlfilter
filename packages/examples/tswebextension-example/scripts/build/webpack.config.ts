import path from 'path';
import { Configuration } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import {
    BACKGROUND_PATH,
    CONTENT_SCRIPT,
    POPUP_PATH,
    BUILD_PATH,
} from '../constants';

const isFFBuild = process.env.BROWSER === 'firefox';

export const config: Configuration = {
    mode: 'development',
    devtool: 'eval-source-map',
    entry: {
        background: BACKGROUND_PATH,
        'content-script': CONTENT_SCRIPT,
        'pages/popup': POPUP_PATH,
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
            template: path.join(BACKGROUND_PATH, 'index.html'),
            filename: 'background.html',
            chunks: ['background'],
            cache: false,
        }),
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
                    from: isFFBuild ? 'manifest.firefox.json' : 'manifest.chrome.json',
                    to: 'manifest.json',
                },
            ],
        }),
    ],
};
