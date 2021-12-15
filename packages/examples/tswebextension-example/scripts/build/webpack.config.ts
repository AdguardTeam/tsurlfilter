import path from 'path';
import { Configuration } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';

const BACKGROUND_PATH = path.resolve(__dirname, '../../extension/pages/background');
const CONTENT_SCRIPT = path.resolve(__dirname, '../../extension/pages/content-script');
const POPUP_PATH = path.resolve(__dirname, '../../extension/pages/popup');
const BUILD_PATH = path.resolve(__dirname, '../../build');

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
                use: ["style-loader", "css-loader"],
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
                    from: 'manifest.json',
                    to: 'manifest.json',
                },
                {
                    context: 'extension',
                    from: 'war',
                    to: 'war',
                },
            ],
        }),
    ],
};
