colors = require('colors');

var firestore = require('../google/firestore/v1beta1/firestore_pb.js');

module.exports = {

  listDocumentsMethod: function (client) {

    console.log(colors.green.underline("\n:: Listing all documents from Firestore... ::\n"));

    var listDocsRequest = new firestore.ListDocumentsRequest();
    listDocsRequest.setParent('projects/firestoretestclient/databases/(default)/documents');
    listDocsRequest.setCollectionId('GrpcTestData');

    client.listDocuments(listDocsRequest, listDocsCallback);

    function listDocsCallback(error, response) {
      if (error) {
        console.log(colors.red.bold(error.toString()));
        menu.drawMenu();
        return;
      }

      var docArray = response.getDocumentsList();
      var i = 0;
      docArray.forEach(function (doc) {
        i++;
        var docName = doc.array[0];
        console.log(colors.white.bold("Document " + i + ": ") + colors.yellow(docName));
      });
      menu.drawMenu();
      return;
    } //listDocsCallback

  } //listDocumentsMethod

} //module.exports

