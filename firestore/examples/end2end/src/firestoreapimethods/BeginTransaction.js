const colors = require('colors');
var firestore = require('../google/firestore/v1beta1/firestore_pb.js');

module.exports = {

    beginTransaction : function (client) {

        console.log(colors.green.bold("\n :: Starting New Transaction ::\n"));
        var options = new firestore.TransactionOptions();
        var beginTransRequest = new firestore.BeginTransactionRequest(options);
        beginTransRequest.setDatabase("projects/firestoretestclient/databases/(default)");
        client.beginTransaction(beginTransRequest,beginTransCallback);

        function beginTransCallback(error,response) {
            if (error) {
                console.log(colors.red.bold(error));
                menu.drawMenu();
                return;
            }
            transactionId = response.getTransaction();
            console.log(colors.green.bold("\n Successfully began new transaction '" + colors.white.bold(transactionId.toString()) + colors.green.bold("'!")));
            menu.drawMenu();


        }

    }

}
