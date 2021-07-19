/**
 * @license
 * Copyright 2018 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/**
 * @fileoverview Integration tests for spanner grpc requests.
 */

'use strict';

const protoLoader = require('@grpc/proto-loader');
const assert = require('assert');
const getGrpcGcpObjects = require('../../build/src');

const PROTO_PATH = __dirname + '/../../protos/test_service.proto';
const packageDef = protoLoader.loadSync(PROTO_PATH);

for (const grpcLibName of ['grpc', '@grpc/grpc-js']) {
  describe('Using ' + grpcLibName, () => {
    const grpc = require(grpcLibName);
    const grpcGcp = getGrpcGcpObjects(grpc);

    const server_insecure_creds = grpc.ServerCredentials.createInsecure();
    const Client = grpc.loadPackageDefinition(packageDef).TestService;

    const initApiConfig = function () {
      return grpcGcp.createGcpApiConfig({
        channelPool: {
          maxSize: 10,
          maxConcurrentStreamsLowWatermark: 1,
        },
      });
    };

    describe('Local service integration tests', () => {
      let server;
      let port;
      before(done => {
        // var packageDef = protoLoader.loadSync(PROTO_PATH);
        // Client = grpc.loadPackageDefinition(packageDef).TestService;
        server = new grpc.Server();
        server.addService(Client.service, {
          unary: function (call, cb) {
            call.sendMetadata(call.metadata);
            cb(null, {});
          },
          clientStream: function (stream, cb) {
            stream.on('data', data => {});
            stream.on('end', () => {
              stream.sendMetadata(stream.metadata);
              cb(null, {});
            });
          },
          serverStream: function (stream) {
            stream.sendMetadata(stream.metadata);
            stream.end();
          },
          bidiStream: function (stream) {
            stream.on('data', data => {});
            stream.on('end', () => {
              stream.sendMetadata(stream.metadata);
              stream.end();
            });
          },
        });
        server.bindAsync(
          'localhost:0',
          server_insecure_creds,
          (error, boundPort) => {
            if (error) {
              done(error);
            }
            port = boundPort;
            server.start();
            done();
          }
        );
      });
      after(() => {
        server.forceShutdown();
      });

      describe('Different channel options', () => {
        it('no api config', done => {
          const channelOptions = {
            channelFactoryOverride: grpcGcp.gcpChannelFactoryOverride,
            callInvocationTransformer: grpcGcp.gcpCallInvocationTransformer,
          };
          const client = new Client(
            'localhost:' + port,
            grpc.credentials.createInsecure(),
            channelOptions
          );
          const channelFactory = client.getChannel();
          assert(channelFactory instanceof grpcGcp.GcpChannelFactory);
          assert.strictEqual(channelFactory.maxSize, 10);
          assert.strictEqual(
            channelFactory.maxConcurrentStreamsLowWatermark,
            100
          );
          done();
        });
        it('no override function', done => {
          const channelOptions = {
            callInvocationTransformer: grpcGcp.gcpCallInvocationTransformer,
          };
          const client = new Client(
            'localhost:' + port,
            grpc.credentials.createInsecure(),
            channelOptions
          );
          const channel = client.getChannel();
          assert(channel instanceof grpc.Channel);
          done();
        });
      });

      describe('Echo metadata', () => {
        let metadata;
        let client;
        before(() => {
          const apiConfig = initApiConfig();
          const channelOptions = {
            channelFactoryOverride: grpcGcp.gcpChannelFactoryOverride,
            callInvocationTransformer: grpcGcp.gcpCallInvocationTransformer,
            gcpApiConfig: apiConfig,
          };

          client = new Client(
            'localhost:' + port,
            grpc.credentials.createInsecure(),
            channelOptions
          );

          metadata = new grpc.Metadata();
          metadata.set('key', 'value');
        });
        it('with unary call', done => {
          const call = client.unary({}, metadata, (err, data) => {
            assert.ifError(err);
          });
          call.on('metadata', metadata => {
            assert.deepStrictEqual(metadata.get('key'), ['value']);
            done();
          });
        });
        it('with client stream call', done => {
          const call = client.clientStream(metadata, (err, data) => {
            assert.ifError(err);
          });
          call.on('metadata', metadata => {
            assert.deepStrictEqual(metadata.get('key'), ['value']);
            done();
          });
          call.end();
        });
        it('with server stream call', done => {
          const call = client.serverStream({}, metadata);
          call.on('data', () => {});
          call.on('metadata', metadata => {
            assert.deepStrictEqual(metadata.get('key'), ['value']);
            done();
          });
        });
        it('with bidi stream call', done => {
          const call = client.bidiStream(metadata);
          call.on('data', () => {});
          call.on('metadata', metadata => {
            assert.deepStrictEqual(metadata.get('key'), ['value']);
            done();
          });
          call.end();
        });
        it('properly handles duplicate values', done => {
          const dup_metadata = metadata.clone();
          dup_metadata.add('key', 'value2');
          const call = client.unary({}, dup_metadata, (err, data) => {
            assert.ifError(err);
          });
          call.on('metadata', resp_metadata => {
            // Two arrays are equal iff their symmetric difference is empty
            const actual_values = resp_metadata.get('key');
            if (actual_values.length === 1) {
              assert.deepStrictEqual(actual_values, ['value, value2']);
            } else {
              assert.deepStrictEqual(actual_values, ['value', 'value2']);
            }
            done();
          });
        });
        describe('Call argument handling', () => {
          describe('Unary call', () => {
            it('Should handle missing options', done => {
              const call = client.unary({}, metadata, (err, data) => {
                assert.ifError(err);
              });
              call.on('metadata', metadata => {
                assert.deepStrictEqual(metadata.get('key'), ['value']);
                done();
              });
            });
            it('Should handle missing metadata and options', done => {
              const call = client.unary({}, (err, data) => {
                assert.ifError(err);
              });
              call.on('metadata', metadata => {
                done();
              });
            });
          });
          describe('Client stream call', () => {
            it('Should handle missing options', done => {
              const call = client.clientStream(metadata, (err, data) => {
                assert.ifError(err);
              });
              call.on('metadata', metadata => {
                assert.deepStrictEqual(metadata.get('key'), ['value']);
                done();
              });
              call.end();
            });
            it('Should handle missing metadata and options', done => {
              const call = client.clientStream((err, data) => {
                assert.ifError(err);
              });
              call.on('metadata', metadata => {
                done();
              });
              call.end();
            });
          });
          describe('Server stream call', () => {
            it('Should handle missing options', done => {
              const call = client.serverStream({}, metadata);
              call.on('data', () => {});
              call.on('metadata', metadata => {
                assert.deepStrictEqual(metadata.get('key'), ['value']);
                done();
              });
            });
            it('Should handle missing metadata and options', done => {
              const call = client.serverStream({});
              call.on('data', () => {});
              call.on('metadata', metadata => {
                done();
              });
            });
          });
          describe('Bidi stream call', () => {
            it('Should handle missing options', done => {
              const call = client.bidiStream(metadata);
              call.on('data', () => {});
              call.on('metadata', metadata => {
                assert.deepStrictEqual(metadata.get('key'), ['value']);
                done();
              });
              call.end();
            });
            it('Should handle missing metadata and options', done => {
              const call = client.bidiStream();
              call.on('data', () => {});
              call.on('metadata', metadata => {
                done();
              });
              call.end();
            });
          });
        });
      });
    });
  });
}
