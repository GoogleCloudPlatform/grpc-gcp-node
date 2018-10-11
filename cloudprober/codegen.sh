#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

rm -rf google

PROTOC=./node_modules/grpc-tools/bin/protoc.js

for p in $(find ../third_party/googleapis/google -type f -name *.proto); do
  $PROTOC \
    --proto_path=../third_party/googleapis \
    --js_out=import_style=commonjs,binary:./ \
    --grpc_out=./ \
    "$p"
done
