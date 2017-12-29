const colors = require('colors');
const draw = require('../gfx/Draw.js');

module.exports = {
    readIndex: function(index) {
        draw.drawLineSeparator();
        var fieldsList = index.getFieldsList();
        var indexName = index.getName();
        var indexState = index.getState();
        if (indexState == 3) { indexState = "CREATING"; }
        if (indexState == 2) { indexState = "READY"; }
        if (indexState == 1) { indexState = "ERROR"; }
        console.log(colors.white.bold("Index Name: ") + colors.yellow.bold(indexName));
        fieldsList.forEach(function (field) {
            var mode = field.getMode();
            if (mode == 2) { mode = "ASCENDING"; }
            if (mode == 3) { mode = "DESCENDING"; }
            console.log(colors.white.bold("Field: ") + colors.gray(field.getFieldPath()) + "   " +
                colors.white.bold("Mode: ") + colors.gray(mode) + "   " +
                colors.white.bold("Status: ") + colors.gray(indexState));
        });

    }
}