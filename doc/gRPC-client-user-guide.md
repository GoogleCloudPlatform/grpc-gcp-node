# Instructions for create a gRPC client for google cloud services

## Overview

This instruction includes a step by step guide for creating a gRPC 
client to test the google cloud service from an empty linux 
VM, using GCE ubuntu 16.04 TLS instance.

The main steps are followed as steps below: 

- Environment prerequisite
- Install gRPC-nodejs and plugin
- Generate client API from .proto files
- Create the client and send/receive RPC.

## Environment Prerequisite

**Nodejs**
```sh
$ curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.25.4/install.sh | bash
$ source ~/.bashrc
$ nvm install 8 && npm config set cache /tmp/npm-cache && npm install -g npm
$ nvm alias default 8
```

## Install gRPC-nodejs and plugin
```sh
$ npm install -g grpc
$ npm install -g grpc-tools
```

## Generate client API from .proto files 
The plugin is installed with grpc-tools.
The command using plugin looks like
```sh
$ mkdir $HOME/project-node
$ grpc_tools_node_protoc --proto_path=./ \
--js_out=import_style=commonjs,binary:=$HOME/project-node \
--grpc_out=project-node \
--plugin=protoc-gen-grpc=which grpc_tools_node_protoc_plugin \
path/to/your/proto_dependency_directory1/*.proto \
path/to/your/proto_dependency_directory2/*.proto \
path/to/your/proto_directory/*.proto
```

Since most of cloud services already publish proto files under 
[googleapis github repo](https://github.com/googleapis/googleapis),
you can generate the client API by using it's Makefile.
The `Makefile` will help you generate the client API as
well as all the dependencies. The command will simply be:
```sh
$ cd $HOME
$ mkdir project-node
$ git clone https://github.com/googleapis/googleapis.git
$ cd googleapis
$ make LANGUAGE=node OUTPUT=$HOME/project-node PROTOC="grpc_tools_node_protoc --proto_path=./ --js_out=import_style=commonjs,binary:$HOME/project-node --grpc_out=$HOME/project-node --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin`" \
FLAGS=""  GRPCPLUGIN=""
```

The client API library is generated under `$HOME/project-node`.
Take [`Firestore`](https://github.com/googleapis/googleapis/blob/master/google/firestore/v1beta1/firestore.proto)
as example, the Client API is under 
`$HOME/project-node/google/firestore/v1beta1` depends on your 
package namespace inside .proto file. An easy way to find your client is 
```sh
$ cd $HOME/project-node
$ find ./ -name [service_name: eg, firestore, cluster_service]*
```

## Create the client and send/receive RPC.
Now it's time to use the client API to send and receive RPCs.

**Install related packages**
``` sh
$ cd $HOME/project-node
$ vim package.json
##### paste
{
  "name": "firestore-grpc-test-client",
  "version": "0.1.0",
  "dependencies": {
    "@google-cloud/firestore": "^0.10.0",
    "async": "^1.5.2",
    "ca-store": "^1.1.1",
    "colors": "1.1.2",
    "eslint": "4.12.1",
    "firebase-admin": "^5.5.1",
    "fs": "0.0.1-security",
    "google-auth-library": "^0.12.0",
    "google-protobuf": "^3.0.0",
    "googleapis": "^23.0.0",
    "grpc": "1.7.3",
    "lodash": "^4.6.1",
    "minimist": "^1.2.0",
    "prompt": "1.0.0"
  }
}
#####
$ npm install
``` 


**Set credentials file**

This is important otherwise your RPC response will be a permission error.
``` sh
$ vim $HOME/key.json
## Paste you credential file downloaded from your cloud project
## which you can find in APIs&Services => credentials => create credentials
## => Service account key => your credentials
$ export GOOGLE_APPLICATION_CREDENTIALS=$HOME/key.json
```

**Implement Service Client**

Take a unary-unary RPC `listDocument` from `FirestoreClient` as example.
Create a file name `$HONE/project-node/list_document_client.js`.
- Import library
```
var firestore = require('./google/firestore/v1beta1/firestore_pb.js');
var services = require('./google/firestore/v1beta1/firestore_grpc_pb.js');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var grpc = require('grpc');
var colors = require('colors');
```
- Set Google Auth. Please see the referece for 
[authenticate with Google using an Oauth2 token](https://grpc.io/docs/guides/auth.html#authenticate-with-google-using-oauth2-token-legacy-approach)
for the use of 'googleauth' library.
```
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
```

- Create Client
```
       client = new services.FirestoreClient("firestore.googleapis.com:443", channel_creds);
```
- Make and receive RPC call
```
       var listDocsRequest = new firestore.ListDocumentsRequest();
       listDocsRequest.setParent('projects/{project_name}/databases/(default)/documents');
       client.listDocuments(listDocsRequest, listDocsCallback);
```
- Print RPC response
```
        function listDocsCallback(error, response) {
                if (error) {
                        console.log(colors.red.bold(error.toString()));
                        menu.drawMenu();
                        return;
                }

                var docArray = response.getDocumentsList();
                var i = 0;
                docArray.forEach(function (doc) {
                                i++;
                                var docName = doc.array[0];
                                console.log(colors.white.bold("Document " + i + ": ") + colors.yellow(docName));
                                });
                menu.drawMenu();
                return;
        }
});
```
- Run the script
```sh
$ node list_document_client.js
```

For different kinds of RPC(unary-unary, unary-stream, stream-unary, stream-stream),
please check [grpc.io Node part](https://grpc.io/docs/tutorials/basic/node.html#simple-rpc)
for reference.


