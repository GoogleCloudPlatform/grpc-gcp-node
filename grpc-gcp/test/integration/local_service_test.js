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
const _ = require('lodash');
const getGrpcGcpObjects = require('../../build/src');

const PROTO_PATH = __dirname + '/../../protos/test_service.proto';
var packageDef = protoLoader.loadSync(PROTO_PATH);

for (const grpcLibName of ['grpc', '@grpc/grpc-js']) {

  describe('Using ' + grpcLibName, function() {
    const grpc = require(grpcLibName);
    const grpcGcp = getGrpcGcpObjects(grpc);

    var server_insecure_creds = grpc.ServerCredentials.createInsecure();
    var Client = grpc.loadPackageDefinition(packageDef).TestService;

    var initApiConfig = function() {
      return grpcGcp.createGcpApiConfig({
        channelPool: {
          maxSize: 10,
          maxConcurrentStreamsLowWatermark: 1,
        },
      });
    };

    describe('Local service integration tests', function() {
      var server;
      var port;
      before(function(done) {
        // var packageDef = protoLoader.loadSync(PROTO_PATH);
        // Client = grpc.loadPackageDefinition(packageDef).TestService;
        server = new grpc.Server();
        server.addService(Client.service, {
          unary: function(call, cb) {
            call.sendMetadata(call.metadata);
            cb(null, {});
          },
          clientStream: function(stream, cb) {
            stream.on('data', function(data) {});
            stream.on('end', function() {
              stream.sendMetadata(stream.metadata);
              cb(null, {});
            });
          },
          serverStream: function(stream) {
            stream.sendMetadata(stream.metadata);
            stream.end();
          },
          bidiStream: function(stream) {
            stream.on('data', function(data) {});
            stream.on('end', function() {
              stream.sendMetadata(stream.metadata);
              stream.end();
            });
          },
        });
        server.bindAsync('localhost:0', server_insecure_creds, (error, boundPort) => {
          if (error) {
            done(error);
          }
          port = boundPort;
          server.start();
          done();
        });
      });
      after(function() {
        server.forceShutdown();
      });

      describe('Different channel options', () => {
        it('no api config', function(done) {
          var channelOptions = {
            channelFactoryOverride: grpcGcp.gcpChannelFactoryOverride,
            callInvocationTransformer: grpcGcp.gcpCallInvocationTransformer,
          };
          var client = new Client(
            'localhost:' + port,
            grpc.credentials.createInsecure(),
            channelOptions
          );
          var channelFactory = client.getChannel();
          assert(channelFactory instanceof grpcGcp.GcpChannelFactory);
          assert.strictEqual(channelFactory.maxSize, 10);
          assert.strictEqual(channelFactory.maxConcurrentStreamsLowWatermark, 100);
          done();
        });
        it('no override function', function(done) {
          var channelOptions = {
            callInvocationTransformer: grpcGcp.gcpCallInvocationTransformer,
          };
          var client = new Client(
            'localhost:' + port,
            grpc.credentials.createInsecure(),
            channelOptions
          );
          var channel = client.getChannel();
          assert(channel instanceof grpc.Channel);
          done();
        });
      });

      describe('Echo metadata', () => {
        var metadata;
        var client;
        before(() => {
          var apiConfig = initApiConfig();
          var channelOptions = {
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
        it('with unary call', function(done) {
          var call = client.unary({}, metadata, function(err, data) {
            assert.ifError(err);
          });
          call.on('metadata', function(metadata) {
            assert.deepStrictEqual(metadata.get('key'), ['value']);
            done();
          });
        });
        it('with client stream call', function(done) {
          var call = client.clientStream(metadata, function(err, data) {
            assert.ifError(err);
          });
          call.on('metadata', function(metadata) {
            assert.deepStrictEqual(metadata.get('key'), ['value']);
            done();
          });
          call.end();
        });
        it('with server stream call', function(done) {
          var call = client.serverStream({}, metadata);
          call.on('data', function() {});
          call.on('metadata', function(metadata) {
            assert.deepStrictEqual(metadata.get('key'), ['value']);
            done();
          });
        });
        it('with bidi stream call', function(done) {
          var call = client.bidiStream(metadata);
          call.on('data', function() {});
          call.on('metadata', function(metadata) {
            assert.deepStrictEqual(metadata.get('key'), ['value']);
            done();
          });
          call.end();
        });
        it('properly handles duplicate values', function(done) {
          var dup_metadata = metadata.clone();
          dup_metadata.add('key', 'value2');
          var call = client.unary({}, dup_metadata, function(err, data) {
            assert.ifError(err);
          });
          call.on('metadata', function(resp_metadata) {
            // Two arrays are equal iff their symmetric difference is empty
            var actual_values = resp_metadata.get('key');
            if (actual_values.length == 1) {
              assert.deepStrictEqual(actual_values, ['value, value2']);
            } else {
              assert.deepStrictEqual(actual_values, ['value', 'value2']);
            }
            done();
          });
        });
        describe('Call argument handling', function() {
          describe('Unary call', function() {
            it('Should handle missing options', function(done) {
              var call = client.unary({}, metadata, function(err, data) {
                assert.ifError(err);
              });
              call.on('metadata', function(metadata) {
                assert.deepStrictEqual(metadata.get('key'), ['value']);
                done();
              });
            });
            it('Should handle missing metadata and options', function(done) {
              var call = client.unary({}, function(
                err,
                data
              ) {
                assert.ifError(err);
              });
              call.on('metadata', function(metadata) {
                done();
              });
            });
          });
          describe('Client stream call', function() {
            it('Should handle missing options', function(done) {
              var call = client.clientStream(metadata, function(
                err,
                data
              ) {
                assert.ifError(err);
              });
              call.on('metadata', function(metadata) {
                assert.deepStrictEqual(metadata.get('key'), ['value']);
                done();
              });
              call.end();
            });
            it('Should handle missing metadata and options', function(done) {
              var call = client.clientStream(function(
                err,
                data
              ) {
                assert.ifError(err);
              });
              call.on('metadata', function(metadata) {
                done();
              });
              call.end();
            });
          });
          describe('Server stream call', function() {
            it('Should handle missing options', function(done) {
              var call = client.serverStream({}, metadata);
              call.on('data', function() {});
              call.on('metadata', function(metadata) {
                assert.deepStrictEqual(metadata.get('key'), ['value']);
                done();
              });
            });
            it('Should handle missing metadata and options', function(done) {
              var call = client.serverStream({});
              call.on('data', function() {});
              call.on('metadata', function(metadata) {
                done();
              });
            });
          });
          describe('Bidi stream call', function() {
            it('Should handle missing options', function(done) {
              var call = client.bidiStream(metadata);
              call.on('data', function() {});
              call.on('metadata', function(metadata) {
                assert.deepStrictEqual(metadata.get('key'), ['value']);
                done();
              });
              call.end();
            });
            it('Should handle missing metadata and options', function(done) {
              var call = client.bidiStream();
              call.on('data', function() {});
              call.on('metadata', function(metadata) {
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
