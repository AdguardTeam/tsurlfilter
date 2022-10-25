const path = require("path");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ESLintPlugin = require("eslint-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
    entry: {
        "index": "./src/background/index.ts",
        "content-script": "./src/content-script/index.ts"
    },
    module: {
        rules: [
            {
                test: /\.ts/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "babel-loader",
                        options: { presets: ["@babel/preset-env", "@babel/preset-typescript"] },
                    },
                ],
            },
        ],
    },
    experiments: {
        outputModule: true,
      },
    plugins: [
        new CleanWebpackPlugin(),
        new ESLintPlugin({ fix: true })
    ],
    resolve: {
        extensions: ['.ts', '.js'],
        // Node modules polyfills
        fallback: {
            url: require.resolve('url'),
        },
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                extractComments: false,
                terserOptions: {
                    format: {
                        comments: false,
                    },
                },
            }),
        ],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, "dist"),
        library: {
            type: 'module',
          },
    },
};
