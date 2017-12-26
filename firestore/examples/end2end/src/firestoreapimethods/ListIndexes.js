const colors = require('colors');
var draw = require('../util/gfx/Draw.js');
var readIndex = require('../util/control/ReadIndex.js');

var firestoreAdmin = require('../google/firestore/admin/v1beta1/firestore_admin_pb.js')

module.exports = {

    listIndexes: function (client, drawMenu) {

        console.log(colors.green.bold("\n:: Listing all Indexes ::\n"));

        var listIndexesRequest = new firestoreAdmin.ListIndexesRequest();
        listIndexesRequest.setParent('projects/firestoretestclient/databases/(default)');

        client.listIndexes(listIndexesRequest, listIndexRequestCallback);

        function listIndexRequestCallback(error, response) {
            if (error) {
                console.log(colors.red.bold(error));
                menu.drawMenu();
                return;
            }
            else {
                var indexList = response.getIndexesList();
                indexList.forEach( (index) => {
                    readIndex.readIndex(index);
                });
                console.log(colors.green.bold("\nFinished listing indexes!\n"));
                menu.drawMenu();
                return;
            }
        }

    }
}