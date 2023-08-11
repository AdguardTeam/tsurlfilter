import path from "path";
import { Configuration } from "webpack";
import CopyWebpackPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import { BACKGROUND_PATH, CONTENT_SCRIPT, POPUP_PATH, BUILD_PATH, ASSISTANT_INJECT } from "../constants";

export const config: Configuration = {
    mode: "production",
    entry: {
        background: BACKGROUND_PATH,
        "content-script": CONTENT_SCRIPT,
        "adguard-assistant": ASSISTANT_INJECT,
        popup: POPUP_PATH,
    },
    output: {
        path: BUILD_PATH,
        filename: "[name].js",
    },
    resolve: {
        extensions: ["*", ".ts", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.(js|ts)x?$/,
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
                            },
                        },
                    },
                ],
            },
        ],
    },
    optimization: {
        minimize: false,
    },
    plugins: [
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            template: path.join(BACKGROUND_PATH, "index.html"),
            filename: "background.html",
            chunks: ["background"],
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: path.join(POPUP_PATH, "index.html"),
            filename: "popup.html",
            chunks: ["popup"],
            cache: false,
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    context: "extension",
                    from: "manifest.json",
                    to: "manifest.json",
                },
            ],
        }),
    ],
};
