var firestore = require('../../google/firestore/v1beta1/firestore_pb.js');
var ListDocuments = require('../../firestoreapimethods/ListDocuments.js');
var CreateDocument = require('../../firestoreapimethods/CreateDocument.js');
var DeleteDocument = require('../../firestoreapimethods/DeleteDocument.js');
var UpdateDocument = require('../../firestoreapimethods/UpdateDocument.js');
var ListCollectionIds = require('../../firestoreapimethods/ListCollectionIds.js');
var BatchGetDocuments = require('../../firestoreapimethods/BatchGetDocuments.js');
var GetDocument = require('../../firestoreapimethods/GetDocument.js');
var Listen = require('../../firestoreapimethods/Listen.js');
var CreateIndex = require('../../firestoreapimethods/CreateIndex.js');
var ListIndexes = require('../../firestoreapimethods/ListIndexes.js');
var DeleteIndex = require('../../firestoreapimethods/DeleteIndex.js');
var GetIndex = require('../../firestoreapimethods/GetIndex.js');
var BeginTransaction = require('../../firestoreapimethods/BeginTransaction.js');
var Commit = require('../../firestoreapimethods/Commit.js');
var Rollback = require('../../firestoreapimethods/Rollback.js');
var WriteDocStream = require('../../firestoreapimethods/Write.js');
var RunQuery = require('../../firestoreapimethods/RunQuery.js');

module.exports = {
    chooseMethod: function (methodName) {

        switch (methodName) {

            case "batchgetdocuments":
            case "1":
                BatchGetDocuments.batchGetDocumentsMethod(client);
                break;

            case "begintransaction":
            case "2":
                BeginTransaction.beginTransaction(client);
                break;

            case "commit":
            case "3":
                Commit.commit(client);
                break;

            case "createdocument":
            case "4":
                CreateDocument.createDocumentMethod(client);
                break;

            case "deletedocument":
            case "5":
                DeleteDocument.deleteDocumentMethod(client);
                break;

            case "getdocument":
            case "6":
                GetDocument.getDocumentMethod(client);
                break;

            case "listcollectionids":
            case "7":
                ListCollectionIds.listCollectionIdsMethod(client);
                break;

            case "listdocuments":
            case "8":
                ListDocuments.listDocumentsMethod(client);
                break;

            case "rollback":
            case "9":
                Rollback.rollback(client);
                break;

            case "runquery":
            case "10":
                RunQuery.runQuery(client);
                break;

            case "listen":
                Listen.startListener(client);
                break;

            case "updatedocument":
            case "11":
                UpdateDocument.updateDocument(client);
                break;

            case "write":
            case "12":
                WriteDocStream.writeDocStream(client);
                break;

            case "createindex":
            case "13":
                CreateIndex.createIndex(client);
                break;

            case "deleteindex":
            case "14":
                DeleteIndex.deleteIndex(client);
                break;

            case "getindex":
            case "15":
                GetIndex.getIndex(client);
                break;

            case "listindexes":
            case "16":
                ListIndexes.listIndexes(client);
                break;

            default:
                console.log(colors.red.bold("\nUnrecognized Input: " + methodName + "\n"));
                menu.drawMenu();
        }

    }
}