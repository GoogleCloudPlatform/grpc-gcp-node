const colors = require('colors');
var readDoc = require('../util/control/ReadDocument.js');
var readLine = require('readline');

var firestore = require('../google/firestore/v1beta1/firestore_pb.js');

module.exports = {

    batchGetDocumentsMethod: function (client) {

        console.log(colors.green.underline("\n:: Batch Retreive Documents ::\n"));

        const rl = readLine.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        function docIdPrompt(docPromptList) {
            rl.question(colors.white.bold("Enter Document Id (blank when finished): "), function (docId) {
                if (docId != "") {
                    docPromptList.push('projects/firestoretestclient/databases/(default)/documents/GrpcTestData/' + docId);
                    docIdPrompt(docPromptList);
                } //if
                else {

                    var batchGetDocsRequest = new firestore.BatchGetDocumentsRequest();
                    batchGetDocsRequest.setDatabase('projects/firestoretestclient/databases/(default)');
                    batchGetDocsRequest.setDocumentsList(docPromptList);

                    call = client.batchGetDocuments(batchGetDocsRequest);
                    call.on('data', batchGetDocsCallback);

                    call.on('error', function (error) {
                        console.log(colors.red.bold(error.toString()));
                        menu.drawMenu();
                        return;
                    });

                    call.on('end', function (endResponse) {

                        console.log(colors.green.bold("\nFinished retreiving all documents!"));
                        rl.close();
                        menu.drawMenu();
                        return;

                    });
                }
            });
        } //docIdPrompt
        docIdPrompt([]);
        function batchGetDocsCallback(response) {
            if (response.getFound()) {
                readDoc.readDocument(response.getFound());


            }
        } //batchGetDocsCallback

    } //batchGetDocumentsMethod

} //module.exports
