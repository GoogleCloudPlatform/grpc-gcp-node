colors = require('colors');
var readLine = require('readline');
var readIndex = require('../util/control/ReadIndex.js');
var firestoreAdmin = require('../google/firestore/admin/v1beta1/firestore_admin_pb.js')

module.exports = {
    
        getIndex : function (client) {

            console.log(colors.green.bold("\n:: Fetching a new Index ::\n"));

            const rl = readLine.createInterface({
                input: process.stdin,
                output: process.stdout
            });
    
            rl.question(colors.white.bold("Enter Index Id: "), function (indexId) {
                if (indexId != "") {
                    var getIndexRequest = new firestoreAdmin.GetIndexRequest();
                    getIndexRequest.setName('projects/firestoretestclient/databases/(default)/indexes/' + indexId);
                    client.getIndex(getIndexRequest, getIndexCallback);
                }
                else {
                    console.log(colors.red.bold("ERROR:  No Document Id Specified"));
                    meno.drawMemu
                }
                rl.close();
            });
    
            function getIndexCallback(error, response) {
                if (error) {
                    console.log(colors.red.bold(error.toString()));
                    menu.drawMenu();
                    return;
                }
    
                readIndex.readIndex(response);
                console.log(colors.green.bold("\nFinished fetching index!\n"));
                menu.drawMenu();
                return;
            } //getDocCallback



        }
    }