const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const BUILD_PATH = path.join(__dirname, 'build');

const BACKGROUND_PATH = path.join(__dirname, 'extension/pages/background');

const CONTENT_SCRIPT = path.join(__dirname, 'extension/pages/content-script');

const POPUP_PATH = path.join(__dirname, 'extension/pages/popup');

module.exports =  {
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
                    from: 'manifest.json',
                    to: 'manifest.json',
                },
            ],
        }),
    ],
};
