var services = require('../../google/firestore/admin/v1beta1/firestore_admin_grpc_pb.js');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var grpc = require('grpc');
var chooseMethod = require('./ChooseFirestoreMethod.js');
var colors = require('colors');

module.exports = {

  runMethod: function (methodName) {

    var authFactory = new googleAuth();
    var dns = google.dns("v1");

    authFactory.getApplicationDefault(function (err, authClient) {
      if (err) {
        console.log('Authentication failed because of ', err);
        return;
      }
      if (authClient.createScopedRequired && authClient.createScopedRequired()) {
        var scopes = ['https://www.googleapis.com/auth/datastore'];
        authClient = authClient.createScoped(scopes);
      }

      var ssl_creds = grpc.credentials.createSsl();
      call_creds = grpc.credentials.createFromGoogleCredential(authClient);
      var channel_creds = grpc.credentials.combineCallCredentials(ssl_creds, call_creds);
      client = new services.FirestoreAdminClient("firestore.googleapis.com:443", channel_creds);

      chooseMethod.chooseMethod(methodName);

    });








  }

}
