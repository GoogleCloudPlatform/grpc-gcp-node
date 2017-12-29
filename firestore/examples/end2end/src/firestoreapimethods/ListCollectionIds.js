colors = require('colors');

var firestore = require('../google/firestore/v1beta1/firestore_pb.js');

module.exports = {

  listCollectionIdsMethod: function (client) {

    console.log(colors.green.underline("\n:: Listing all Collection Ids from Document or Database... ::\n"));

    var listCidsRequest = new firestore.ListCollectionIdsRequest();
    listCidsRequest.setParent('projects/firestoretestclient/databases/(default)');

    client.listCollectionIds(listCidsRequest, listCidsCallback);

    function listCidsCallback(error, response) {
      if (error) {
        console.log(colors.red.bold(error.toString()));
        menu.drawMenu();
        return;
      }

      var cidArray = response.array;
      var i = 0;
      cidArray.forEach(function (cid) {
        i++;
        console.log(colors.white.bold("Collection ID " + i + ": ") + colors.yellow(cid));
      });
      menu.drawMenu();
      return;
    } //listDocsCallback

  } //listDocumentsMethod

} //module.exports
