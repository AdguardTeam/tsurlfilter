/* eslint-disable no-console  */
/* eslint-disable import/no-extraneous-dependencies */
import webpack, { Stats, Configuration } from "webpack";

type CompilerCallback = (err?: Error | null, stats?: Stats) => void;

export const buildRunner = (webpackConfig: Configuration, watch = false): Promise<void> => {
    const compiler = webpack(webpackConfig);

    const run = watch ? (cb: CompilerCallback) => compiler.watch({}, cb) : (cb: CompilerCallback) => compiler.run(cb);

    return new Promise((resolve, reject) => {
        run((err?: Error | null, stats?: Stats) => {
            if (err) {
                console.error(err.stack || err);
                reject();
                return;
            }
            if (stats === undefined) {
                reject();
                return;
            }
            if (stats.hasErrors()) {
                console.log(
                    stats.toString({
                        colors: true,
                        all: false,
                        errors: true,
                        moduleTrace: true,
                        logging: "error",
                    })
                );
                reject();
                return;
            }

            console.log(
                stats.toString({
                    chunks: false, // Makes the build much quieter
                    colors: true, // Shows colors in the console
                })
            );
            resolve();
        });
    });
};
