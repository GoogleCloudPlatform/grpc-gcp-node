const colors = require('colors');
var firestore = require('../google/firestore/v1beta1/firestore_pb.js');

module.exports = {

    rollback : function (client) {

        console.log(colors.green.bold("\n :: Starting Rollback ::\n"));
        if (!transactionId) {
            console.log(colors.yellow.bold("No transaction to rollback, returning!\n"));
            menu.drawMenu();
            return;
        }
        var options = new firestore.TransactionOptions();
        var rollbackRequest = new firestore.RollbackRequest();
        rollbackRequest.setDatabase("projects/firestoretestclient/databases/(default)");
        rollbackRequest.setTransaction(transactionId);
        client.rollback(rollbackRequest,rollbackRequestCallback);

        function rollbackRequestCallback(error, response) {
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