var firestore = require('../google/firestore/v1beta1/firestore_pb.js');
var common = require('../google/firestore/v1beta1/common_pb.js');
var grpc = require('grpc');
var colors = require('colors');
var readLine = require('readline');
var jspb = require('google-protobuf');

module.exports = {

    updateDocument: function (client) {

        console.log(colors.green.bold("\n:: Update a Document ::\n"));

        const rl = readLine.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        var updateDocRequest = new firestore.UpdateDocumentRequest();

        rl.question(colors.white.bold("Enter Document Id: "), function (documentId) {

            var getDocRequest = new firestore.GetDocumentRequest();
            getDocRequest.setName('projects/firestoretestclient/databases/(default)/documents/GrpcTestData/' + documentId);
            client.getDocument(getDocRequest, getDocCallback);

        });

        function getDocCallback(error, document, docMask) {

            var fieldsPrompt = function (fieldName, document, docMask) {
                rl.question(colors.white.bold("Enter Field Name (blank when finished): "), function (fieldName) {
                    if (fieldName != "") {

                        rl.question(colors.white.bold("Enter Field Value: "), function (fieldValue) {
                            var value = new firestore.Value();
                            value.setStringValue(fieldValue);
                            document.getFieldsMap().set(fieldName, value);
                            docMask.addFieldPaths(fieldName);
                            fieldsPrompt(fieldName, document, docMask);

                        }); //end Field Mode Prompt
                    } //if
                    else {

                        updateDocRequest.setUpdateMask(docMask);
                        updateDocRequest.setDocument(document);
                        client.updateDocument(updateDocRequest, updateDocCallback);
                        return rl.close();

                    }
                });  //End Field Name Prompt         

            }

            if (error) {
                if (error.toString().endsWith("not found.")) {
                    document = new firestore.Document();
                    document.setName(this.argument.toString());
                    var docMask = new common.DocumentMask();
                    fieldsPrompt("",document,docMask);
                }
                else {
                    console.log(colors.red.bold(error));
                    menu.drawMenu();
                    return;
                }
            }
            var docMask = new common.DocumentMask();
            fieldsPrompt("",document,docMask);

        }

        function updateDocCallback(error, response) {
            if (error) {
                console.log(colors.red.bold(error));
                menu.drawMenu();
                return;
            }
            console.log(colors.green.bold("\nFinished updating document!\n"));
            menu.drawMenu();
            return;

        }



    }


}