var firestore = require('../google/firestore/v1beta1/firestore_pb.js');
var colors = require('colors');
var prompt = require('prompt');
const readLine = require('readline');

module.exports = {

    createDocumentMethod: function (client) {

        console.log(colors.green.underline("\n:: Creating a new Document ::\n"));

        const rl = readLine.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(colors.white.bold("Enter Document ID: "), (documentId) => {
            var createDocRequest = new firestore.CreateDocumentRequest();
            var document = new firestore.Document;
            createDocRequest.setParent('projects/firestoretestclient/databases/(default)/documents');
            createDocRequest.setDocumentId(documentId);
            createDocRequest.setCollectionId('GrpcTestData');
            createDocRequest.setDocument(document);
            client.createDocument(createDocRequest, createDocCallback);
            rl.close();
        });

        //   });
        function createDocCallback(error, response) {
            if (error) {
                console.log(colors.red.bold(error.toString()));
                menu.drawMenu();
                return;
            }
            console.log(colors.green("Successfully created new document!\nName: \n") +
                colors.green.bold(response.getName()) + "\n");
            menu.drawMenu();
            return;
        }

    }

}