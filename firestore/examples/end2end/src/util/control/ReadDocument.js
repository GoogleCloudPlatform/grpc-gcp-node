const colors = require('colors');
const draw = require('../gfx/Draw.js');

module.exports = {

  readDocument: function (document) {
    draw.drawLineSeparator();
    var fieldsMap = document.getFieldsMap();
    var i = 0;
    var entryList = fieldsMap.getEntryList();
    // Display full document name
    console.log(colors.white.bold.underline('Document Name: ') + colors.yellow.bold.underline(document.getName().toString()));
    // Display created timestamp
    if (document.hasCreateTime()) {
      console.log(colors.white.bold("Created: ") + colors.yellow.bold(document.getCreateTime().toDate()));
    }
    // Display updated timestamp
    if (document.hasUpdateTime()) {
      console.log(colors.white.bold("Updated: ") + colors.yellow.bold(document.getUpdateTime().toDate()));
    }
    // Display document fields
    console.log("\n" + colors.white.bold.underline("Document Fields"));
    entryList.forEach(function (field) {
      i++;
      console.log(colors.white.bold("Field " + i + ": ")
        + colors.white(field[0]) + " : " + colors.grey(field[1][field[1].length - 1]));
    });
    //console.log("\n");
    return;

  }

}