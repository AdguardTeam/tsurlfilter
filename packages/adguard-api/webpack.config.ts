/* eslint-disable jsdoc/require-file-overview */
const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");

const MODE = process.env.MODE || "production";

module.exports = {
    mode: MODE,
    devtool: "source-map",
    entry: {
        "adguard-api": "./src/background/index.ts",
        "adguard-content": "./src/content-script/index.ts",
    },
    module: {
        rules: [
            {
                test: /\.ts/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "babel-loader",
                        options: {
                            presets: [
                                [
                                    "@babel/preset-env",
                                    {
                                        targets: {
                                            chrome: "79",
                                            firefox: "78",
                                            opera: "66",
                                        },
                                        useBuiltIns: "usage",
                                        corejs: { version: 3, proposals: true },
                                    },
                                ],
                                "@babel/preset-typescript",
                            ],
                        },
                    },
                ],
            },
        ],
    },
    plugins: [new CleanWebpackPlugin(), new ESLintPlugin()],
    resolve: {
        extensions: [".ts", ".js"],
        // Node modules polyfills
        fallback: {
            url: require.resolve("url"),
        },
    },
    optimization: {
        minimize: false,
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist"),
        library: {
            type: "umd",
        },
    },
};
