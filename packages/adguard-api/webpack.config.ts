/**
 * @file
 * This file is part of Adguard API library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api).
 *
 * Adguard API is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API. If not, see <http://www.gnu.org/licenses/>.
 */
import path from "path";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import ESLintPlugin from "eslint-webpack-plugin";
import { ASSISTANT_OUTPUT, CONTENT_SCRIPT_OUTPUT, API_OUTPUT } from "./constants";

const MODE = process.env.MODE || "production";

export default {
    mode: MODE,
    devtool: "source-map",
    entry: {
        [API_OUTPUT]: "./src/background/index.ts",
        [CONTENT_SCRIPT_OUTPUT]: "./src/content-script/index.ts",
        [ASSISTANT_OUTPUT]: "./src/content-script/assistant.ts",
    },
    module: {
        rules: [
            {
                test: /\.ts/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "swc-loader",
                        options: {
                            env: {
                                targets: {
                                    chrome: 79,
                                    firefox: 78,
                                    opera: 66,
                                },
                                mode: "usage",
                                coreJs: "3.30",
                            },
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
            // url required by @adguard/filters-downloader package, but we use browser submodule,
            // so we can ignore url polyfill
            url: false,
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
