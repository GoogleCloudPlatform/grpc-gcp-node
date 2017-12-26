const colors = require('colors');
var firestore = require('../google/firestore/v1beta1/firestore_pb.js');
var query = require('../google/firestore/v1beta1/query_pb.js');
var readDoc = require('../util/control/ReadDocument.js');

module.exports = {

    runQuery: function (client) {

        console.log(colors.green.bold(":: Run a Structured Query ::"));

        runQueryQuery = new query.StructuredQuery();
        runQueryRequest = new firestore.RunQueryRequest();

        runQueryQuery.setSelect(query.StructuredQuery.Projection(query.StructuredQuery.FieldReference(["asdf"])));
        runQueryRequest.setParent("projects/firestoretestclient/databases/(default)/documents");
        runQueryRequest.setStructuredQuery(runQueryQuery);

        call = client.runQuery(runQueryRequest);

        call.on('data', (response) => {
             readDoc.readDocument(response.getDocument());
        });

        call.on('error',(error) => {
            console.log(colors.red.bold(error));
        });
        function runQueryCallback (error,response) {
            if (error) {
                console.log(colors.red.bold(error));
                return;
            }
            else {
                console.log(response);
            }
        } 

    }


}