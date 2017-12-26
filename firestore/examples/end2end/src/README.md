To generate code from protos, use:

grpc_tools_node_protoc --js_out=import_style=commonjs,binary:./node.js/FireStoreTestClient --grpc_out=./node.js/FireStoreTestClient --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` /path/to/*.proto

Setup with npm install -g grpc-tools 


