const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");

module.exports = {
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
                        options: { presets: ["@babel/preset-env", "@babel/preset-typescript"] },
                    },
                ],
            },
        ],
    },
    plugins: [new CleanWebpackPlugin(), new ESLintPlugin({ fix: true })],
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
