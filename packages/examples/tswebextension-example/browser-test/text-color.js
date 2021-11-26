const chalk = require("chalk");

exports.colorizeStatusText = (status) => {
    return status === 'passed'
        ? chalk.green(status)
        : chalk.red(status);
}