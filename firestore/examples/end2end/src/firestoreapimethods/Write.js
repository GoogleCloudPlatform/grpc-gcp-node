var firestore = require('../google/firestore/v1beta1/firestore_pb.js');
var common = require('../google/firestore/v1beta1/common_pb.js');
var colors = require('colors');
var readLine = require('readline');

module.exports = {

    writeDocStream: function (client) {
        console.log(colors.green.bold("\n:: Streaming Writes to a Document ::\n"));

        const rl = readLine.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(colors.white.bold("Enter Document Id: "), function (documentId) {

            console.log(colors.green.bold("Streaming writes to ") + colors.white.bold(documentId) + " " + colors.green.bold("...\n"));

            fieldsPrompt = function (writeCall, streamId, streamToken) {
                rl.question(colors.white.bold("Enter Field Name (blank when finished): "), function (fieldName) {

                    if (fieldName != "") {

                        rl.question(colors.white.bold("Enter Field Value: "), function (fieldValue) {
                            // Initialize WriteRequest components
                            var value = new firestore.Value();
                            var docMask = new common.DocumentMask();
                            var writeRequest = new firestore.WriteRequest();
                            var currentWrite = new firestore.Write();
                            var document = new firestore.Document();
                            document.setName('projects/firestoretestclient/databases/(default)/documents/GrpcTestData/' + documentId);

                            // Write field names and values locally
                            value.setStringValue(fieldValue);
                            document.getFieldsMap().set(fieldName, value);
                            docMask.addFieldPaths(fieldName);

                            // Create new WriteRequest
                            writeRequest.setDatabase("projects/firestoretestclient/databases/(default)");
                            currentWrite.setUpdate(document);
                            currentWrite.setUpdateMask(docMask);
                            writeRequest.setStreamId(streamId);
                            writeRequest.setStreamToken(streamToken);
                            writeRequest.addWrites(currentWrite);

                            // Send WriteRequest to stream and start capturing responses
                            writeCall.write(writeRequest);
                            writeCall.on('data', (response) => {

                                var streamId = response.getStreamId();
                                var streamToken = response.getStreamToken();
                                fieldsPrompt("", document, "", streamId, streamToken);

                            });
                            writeCall.on('error', (response) => {
                                console.log(colors.red.bold(response));
                                fieldsPrompt();
                            });

                        }); //end Field Value Prompt
                    } //if
                    else {

                        writeCall.end();
                        console.log(colors.green.bold("\nFinished writing data!\n"));
                        rl.close();
                        menu.drawMenu();
                        return;

                    }
                }); //End Field Name Prompt    
            } // fieldsPrompt

            // Send initial WriteRequest to capture Stream ID and first Stream Token
            var writeRequest = new firestore.WriteRequest();
            writeRequest.setDatabase("projects/firestoretestclient/databases/(default)");
            writeCall = client.write();
            writeCall.write(writeRequest);
            writeCall.on('data', (response) => {

                var streamId = response.getStreamId();
                var streamToken = response.getStreamToken();
                if (!fieldName) {
                    var fieldName = "";
                }
                fieldsPrompt(writeCall, streamId, streamToken);

            });

        }); // document Id Prompt

    } // writeDocStream

} // exports