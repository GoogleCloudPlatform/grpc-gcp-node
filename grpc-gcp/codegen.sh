#!/usr/bin/env bash
set -e

PROTOC=./node_modules/grpc-tools/bin/protoc.js
$PROTOC --proto_path=./protos --js_out=import_style=commonjs,binary:./src/generated --grpc_out=./src/generated grpc_gcp.proto
