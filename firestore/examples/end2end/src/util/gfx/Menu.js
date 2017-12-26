const colors = require('colors');
const draw = require('./Draw.js');
const readLine = require('readline');

module.exports = {

    drawMenu: function () {
        const rl = readLine.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log(colors.white.bold.underline("\n     Google Firestore RPC Menu \n"));
        draw.drawLineSeparator();
        console.log("1|batchgetdocuments ......... BatchGetDocuments");
        console.log("2|begintransaction  ......... BeginTransaction");
        console.log("3|commit .................... Commit");
        console.log("4|createdocument ............ CreateDocument");
        console.log("5|deletedocument ............ DeleteDocument");
        console.log("6|getdocument ............... GetDocument");
        console.log("7|listcollectionids ......... ListCollectionIds");
        console.log("8|listdocuments ............. ListDocuments");
        console.log("9|rollback .................. Rollback");
        console.log("10|runquery ................. RunQuery");
        console.log("11|updatedocument ........... UpdateDocument");
        console.log("12|write .................... Write\n");
        console.log(colors.white.bold.underline("     Firestore Admin RPC's         \n"));
        console.log("13|createindex .............. CreateIndex");
        console.log("14|deleteindex .............. DeleteIndex");
        console.log("15|getindex ................. GetIndex");
        console.log("16|listindexes .............. ListIndex\n");

        draw.drawLineSeparator();
        rl.question(colors.white.bold("Enter an Option ('quit' to exit): "), function (method) {
            const runner = require("../control/RunFirestoreMethod.js");
            const runnerAdmin = require('../control/RunFirestoreAdminMethod.js');
            if (method == "quit") { process.exit(); }
            if (method.endsWith("index") || method.endsWith("indexes") || method == "13" || method == "14" || method == "15" || method == "16") {
                runnerAdmin.runMethod(method);
                return rl.close();
            }
            else {
                runner.runMethod(method);
                return rl.close();
            }


        });
    }
}