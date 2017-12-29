colors = require('colors');

var firestore = require('../google/firestore/v1beta1/firestore_pb.js');

module.exports = {

    startListener : function (client) {

        console.log(colors.green.bold(":: Listening for Changes ::"));
        var listenRequest = new firestore.ListenRequest();
        listenRequest.setDatabase('projects/firestoretestclient/databases/(default)');
        docTarget = new firestore.Target();
       //docTarget.setDocuments(
       //     ['projects/firestoretestclient/databases/(default)/documents/GrpcTestData/ThisCoolNewDocument',
       //      'projects/firestoretestclient/databases/(default)/documents/GrpcTestData/CoolNewDocumnent1111']);
    
        listenRequest.setAddTarget(docTarget);
        call = client.listen();
        call.write(listenRequest);

 //       console.log(process._getActiveRequests());
 //       console.log(process._getActiveHandles());

 function logAllEmitterEvents(eventEmitter)
 {
     var emitToLog = eventEmitter.emit;
 
     eventEmitter.emit = function () {
         var event = arguments[0];
         console.log("event emitted: " + event);
         emitToLog.apply(eventEmitter, arguments);
     }
 }
       logAllEmitterEvents(call);
       call.on('data',listenCallback);

       // call.on('resume',listenCallback);

        call.on('readable', function(data) {
            console.log("Readable data detected");
        });

        call.on('status', function(status) {
            console.log(status);
        });

        call.on('metadata', function(metadata) {
            console.log(metadata);
        });

        call.on('target_change', function(document) {
            console.log(document.toString());
        });

        call.on('document_delete', function(document) {
            console.log(document.toString());
        });
        
        call.on('document_change', function(document) {
            console.log(document.toString());
        });

        call.on('error',function(error) {
            console.log(error.toString());
        });

        call.on('child_added', function(child) {
            console.log(child.toString());
        });

        call.on('child_changed', function(child) {
            console.log(child.toString());
        });
        call.on('child_removed', function(child) {
            console.log(child.toString());
        });

        call.on('end',function(endResponse) {
        
            console.log(colors.green.bold("\nFinished listening..."));
        
        });

        function listenCallback(response) {  
               console.log("Data Received..."); 
               console.log(response.toString());
               return;
        
        } //listenCallback

    }

}