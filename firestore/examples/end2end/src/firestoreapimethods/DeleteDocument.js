var colors = require('colors');
var firestore = require('../google/firestore/v1beta1/firestore_pb.js');
const readline = require('readline');

module.exports = {

    deleteDocumentMethod: function (client) {

        console.log(colors.green.underline("\n:: Deleting a Document ::\n"));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(colors.white.bold("Enter Document ID: "), (documentId) => {
            console.log(colors.red("Deleting document ") + colors.red.bold(documentId) + "\n");
            var delDocumentRequest = new firestore.DeleteDocumentRequest();
            delDocumentRequest.setName('projects/firestoretestclient/databases/(default)/documents/GrpcTestData/' + documentId);
            client.deleteDocument(delDocumentRequest, delDocCallback);
            rl.close();
        });
        function delDocCallback(error, response) {
            if (error) {
                console.log(colors.red.bold(error.toString()));
                menu.drawMenu();
                return;
            }
            console.log(colors.green("Successfully deleted document!"));
            menu.drawMenu();
            return;
        }

    } //deleteDocumentMethod
} //module.exports