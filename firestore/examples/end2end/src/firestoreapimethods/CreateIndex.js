colors = require('colors');
var grpc = require('grpc');
const readline = require('readline');
var firestoreAdmin = require('../google/firestore/admin/v1beta1/firestore_admin_pb.js')

module.exports = {

    createIndex: function (client) {

        console.log(colors.green.bold(":: Creating an Index ::\n"));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        var indexPrompt = function (lastAnswer, index) {
            rl.question(colors.white.bold("Enter Field Name (blank when finished): "), function (fieldName) {
                if (fieldName != "") {

                    rl.question(colors.white.bold("Enter Mode (") + colors.white.bold.underline("ASCENDING") +
                        colors.white.bold("/DESCENDING): "), function (fieldMode) {
                            if (fieldMode == "") { fieldMode = 2; }
                            if (fieldMode == "ASCENDING") { fieldMode = 2; }
                            if (fieldMode == "DESCENDING") { fieldMode = 3; }
                            if (fieldMode != 2 && fieldMode != 3) {
                                console.log(colors.red.bold("Unrecognized Mode - Choosing ASCENDING"));
                                fieldMode = 2;
                            }
                            indexField = new firestoreAdmin.IndexField();
                            indexField.setMode(fieldMode);
                            indexField.setFieldPath(fieldName);
                            index.addFields(indexField);
                            indexPrompt(fieldName, index);

                        }); //end Field Mode Prompt
                } //if
                else {

                    var createIndexRequest = new firestoreAdmin.CreateIndexRequest();
                    createIndexRequest.setParent('projects/firestoretestclient/databases/(default)');
                    index.setCollectionId('GrpcTestData');
                    fieldsList = index.getFieldsList();
                    index.setFieldsList(fieldsList);
                    createIndexRequest.setIndex(index);
                    client.createIndex(createIndexRequest, createIndexCallback);
                    return rl.close();

                }
            });  //End Field Name Prompt
        }

        var index = new firestoreAdmin.Index();
        indexPrompt("", index);
        function createIndexCallback(error, response) {
            if (error) {
                console.log(colors.red.bold(error));
                menu.drawMenu();
                return;
            }
            console.log(colors.green.bold("Successfully created index!"));
            menu.drawMenu();
            return;
        }

    } //createIndex

} //exports
