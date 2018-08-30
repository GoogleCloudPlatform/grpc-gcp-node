#!/usr/bin/env bash
cd "$(dirname "$0")"

rm -rf google

PROTOC=../node_modules/grpc-tools/bin/protoc.js

for p in $(find ./googleapis/google -type f -name *.proto); do
  $PROTOC \
    --proto_path=./googleapis \
    --js_out=import_style=commonjs,binary:./ \
    --grpc_out=./ \
    "$p"
done
