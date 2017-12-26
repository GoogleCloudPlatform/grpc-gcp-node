
var colors = require("colors");
global.menu = require("./util/gfx/Menu.js");
global.transactionId;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(colors.red.bold.underline('ERROR: ') +
        colors.red("No credentials specified, please include path to JSON service file in the GOOGLE_APPLICATION_CREDENTIALS environment variable before launching.\n"));
    return 1;
}

menu.drawMenu((method) => {
    if (method.endsWith("index") || method.endsWith("indexes")) {
        runnerAdmin.runMethod(method);

    }
    else {
        runner.runMethod(method);
    }
});

