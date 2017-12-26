var colors = require('colors');
var firestore = require('../google/firestore/v1beta1/firestore_pb.js');
var firestoreAdmin = require('../google/firestore/admin/v1beta1/firestore_admin_pb.js');
var readLine = require('readline');

module.exports = {

    deleteIndex: function (client) {

        console.log(colors.green.bold(":: Deleting an Index ::\n"));

        const rl = readLine.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(colors.white.bold("Enter Index ID: "), (indexId) => {
            console.log(colors.red("Deleting index ") + colors.red.bold(indexId) + "\n");
            var delIndexRequest = new firestoreAdmin.DeleteIndexRequest();
            delIndexRequest.setName('projects/firestoretestclient/databases/(default)/indexes/' + indexId);
            client.deleteIndex(delIndexRequest, delIndexCallback);
            rl.close();
        });
        function delIndexCallback(error, response) {
            if (error) {
                console.log(colors.red.bold(error.toString()));
                menu.drawMenu();
                return;
            }
            console.log(colors.green("Successfully deleted index!"));
            menu.drawMenu();
            return;
        }


    }

}
