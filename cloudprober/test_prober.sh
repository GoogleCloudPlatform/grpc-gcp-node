#!/usr/bin/env bash
cd "$(dirname "$0")"

./setup.sh
node grpc_gcp_prober/prober.js --api=spanner
