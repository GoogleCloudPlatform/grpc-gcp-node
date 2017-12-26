const colors = require('colors');
module.exports = {

    drawLineSeparator: function () {
        var line = "";
        var i = parseInt(process.stdout.columns);
        if (!i) { i = 80; }
        while (i-- != 0) {
            line = line + "-";
        }
        console.log(colors.magenta.bold(line));
    }


}