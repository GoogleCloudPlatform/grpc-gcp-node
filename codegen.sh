#!/usr/bin/env bash
cd "$(dirname "$0")"

PBJS=./node_modules/protobufjs/bin/pbjs
PBTS=./node_modules/protobufjs/bin/pbts
OUTDIR=./src/generated

rm -r $OUTDIR
mkdir $OUTDIR

$PBJS -t static-module -w commonjs -o $OUTDIR/grpc_gcp.js protos/grpc_gcp.proto
echo "Generated src/generated/grpc_gcp.js"

$PBTS -o $OUTDIR/grpc_gcp.d.ts $OUTDIR/grpc_gcp.js
echo "Generated src/generated/grpc_gcp.d.ts"
