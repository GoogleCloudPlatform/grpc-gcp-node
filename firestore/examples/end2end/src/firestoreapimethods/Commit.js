const colors = require('colors');
var firestore = require('../google/firestore/v1beta1/firestore_pb.js');

module.exports = {

    commit : function (client) {

        console.log(colors.green.bold("\n :: Starting Commit ::\n"));
        if (!transactionId) {
            console.log(colors.yellow.bold("No transaction to commit, returning!\n"));
            menu.drawMenu();
            return;
        }
        var options = new firestore.TransactionOptions();
        var commitRequest = new firestore.CommitRequest();
        commitRequest.setDatabase("projects/firestoretestclient/databases/(default)");
        commitRequest.setTransaction(transactionId);
        client.commit(commitRequest,commitRequestCallback);

        function commitRequestCallback(error, response) {
            if (error) {
                console.log(colors.red.bold(error));
                menu.drawMenu();
                return;
            }
            console.log(response);
            menu.drawMenu();

        }

    }

}