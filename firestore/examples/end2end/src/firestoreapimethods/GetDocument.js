colors = require('colors');
var firestore = require('../google/firestore/v1beta1/firestore_pb.js');
var readDoc = require('../util/control/ReadDocument.js');
var readLine = require('readline');

module.exports = {

    getDocumentMethod: function (client) {

        console.log(colors.green.underline("\n:: Fetch a Specific Document... ::\n"));

        const rl = readLine.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(colors.white.bold("Enter Document Id: "), function (docId) {
            if (docId != "") {
                var getDocRequest = new firestore.GetDocumentRequest();
                getDocRequest.setName('projects/firestoretestclient/databases/(default)/documents/GrpcTestData/' + docId);
                client.getDocument(getDocRequest, getDocCallback);
            }
            else {
                console.log(colors.red.bold("ERROR:  No Document Id Specified"));
                meno.drawMemu
            }
            rl.close();
        });

        function getDocCallback(error, response) {
            if (error) {
                console.log(colors.red.bold(error.toString()));
                menu.drawMenu();
                return;
            }

            readDoc.readDocument(response);
            menu.drawMenu();
            return;
        } //getDocCallback

    } //getDocumentMethod

} //module.exports
