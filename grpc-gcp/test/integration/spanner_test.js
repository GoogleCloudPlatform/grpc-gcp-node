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

const PROTO_DIR = __dirname + '/../../../third_party/googleapis';

const protoLoader = require('@grpc/proto-loader');
const assert = require('assert');
const {GoogleAuth} = require('google-auth-library');
const fs = require('fs');
const gax = require('google-gax');

const _TARGET = 'spanner.googleapis.com:443';
const _OAUTH_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const _DATABASE = 'projects/grpc-gcp/instances/sample/databases/benchmark';
const _TEST_SQL = 'select id from storage';
const _CONFIG_FILE = __dirname + '/spanner.grpc.config';

const getGrpcGcpObjects = require('../../build/src');

for (const grpcLibName of ['grpc', '@grpc/grpc-js']) {
  describe('Using ' + grpcLibName, function () {
    const grpc = require(grpcLibName);
    const grpcGcp = getGrpcGcpObjects(grpc);
    describe('Spanner integration tests', () => {
      describe('SpannerClient generated by jspb', () => {
        const spannerPackageDef = protoLoader.loadSync(
          PROTO_DIR + '/google/spanner/v1/spanner.proto',
          {includeDirs: [PROTO_DIR]}
        );
        const spannerGrpc = grpc.loadPackageDefinition(spannerPackageDef);

        let client;
        let pool;

        beforeEach((done) => {
          var authFactory = new GoogleAuth();
          authFactory.getApplicationDefault((err, auth) => {
            assert.ifError(err);

            var scopes = [_OAUTH_SCOPE];
            auth = auth.createScoped(scopes);

            var sslCreds = grpc.credentials.createSsl();
            var callCreds = grpc.credentials.createFromGoogleCredential(auth);
            var channelCreds = grpc.credentials.combineChannelCredentials(
              sslCreds,
              callCreds
            );

            var apiDefinition = JSON.parse(fs.readFileSync(_CONFIG_FILE));
            var apiConfig = grpcGcp.createGcpApiConfig(apiDefinition);

            var channelOptions = {
              channelFactoryOverride: grpcGcp.gcpChannelFactoryOverride,
              callInvocationTransformer: grpcGcp.gcpCallInvocationTransformer,
              gcpApiConfig: apiConfig,
            };

            client = new spannerGrpc.google.spanner.v1.Spanner(
              _TARGET,
              channelCreds,
              channelOptions
            );

            pool = client.getChannel();

            done();
          });
        });

        it('Test session operations', (done) => {
          var createSessionRequest = {database: _DATABASE};
          client.createSession(createSessionRequest, (err, session) => {
            assert.ifError(err);
            var sessionName = session.name;

            var getSessionRequest = {name: sessionName};
            client.getSession(getSessionRequest, (err, sessionResult) => {
              assert.ifError(err);
              assert.strictEqual(sessionResult.name, sessionName);

              var listSessionsRequest = {database: _DATABASE};
              client.listSessions(listSessionsRequest, (err, response) => {
                assert.ifError(err);
                var sessionsList = response.sessions;
                var sessionNames = sessionsList.map((session) => session.name);
                assert(sessionNames.includes(sessionName));

                var deleteSessionRequest = {name: sessionName};
                client.deleteSession(deleteSessionRequest, (err) => {
                  assert.ifError(err);
                  done();
                });
              });
            });
          });
        });

        it('Test executeSql', (done) => {
          var createSessionRequest = {database: _DATABASE};
          client.createSession(createSessionRequest, (err, session) => {
            assert.ifError(err);
            var sessionName = session.name;

            assert.strictEqual(pool.channelRefs.length, 1);
            assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
            assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);

            var executeSqlRequest = {
              session: sessionName,
              sql: _TEST_SQL,
            };
            client.executeSql(executeSqlRequest, (err, resultSet) => {
              assert.ifError(err);
              assert.notStrictEqual(resultSet, null);
              var rowsList = resultSet.rows;
              var value = rowsList[0].values[0].stringValue;

              assert.strictEqual(value, 'payload');
              assert.strictEqual(pool.channelRefs.length, 1);
              assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
              assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);

              var deleteSessionRequest = {name: sessionName};
              client.deleteSession(deleteSessionRequest, (err) => {
                assert.ifError(err);
                assert.strictEqual(pool.channelRefs.length, 1);
                assert.strictEqual(pool.channelRefs[0].affinityCount, 0);
                assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);
                done();
              });
            });
          });
        });

        it('Test executeStreamingSql', (done) => {
          var createSessionRequest = {database: _DATABASE};
          client.createSession(createSessionRequest, (err, session) => {
            assert.ifError(err);
            var sessionName = session.name;

            assert.strictEqual(pool.channelRefs.length, 1);
            assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
            assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);

            var executeSqlRequest = {
              session: sessionName,
              sql: _TEST_SQL,
            };
            var call = client.executeStreamingSql(executeSqlRequest);

            assert.strictEqual(pool.channelRefs.length, 1);
            assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
            assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 1);

            call.on('data', (partialResultSet) => {
              var value = partialResultSet.values[0].stringValue;
              assert.strictEqual(value, 'payload');
            });

            call.on('status', (status) => {
              assert.strictEqual(status.code, grpc.status.OK);
              assert.strictEqual(pool.channelRefs.length, 1);
              assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
              assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);
            });

            call.on('end', function () {
              var deleteSessionRequest = {name: sessionName};
              client.deleteSession(deleteSessionRequest, (err) => {
                assert.ifError(err);
                assert.strictEqual(pool.channelRefs.length, 1);
                assert.strictEqual(pool.channelRefs[0].affinityCount, 0);
                assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);
                done();
              });
            });
          });
        });

        it('Test concurrent streams watermark', (done) => {
          var watermark = 5;
          pool.maxConcurrentStreamsLowWatermark = watermark;

          var expectedNumChannels = 3;

          var createCallPromises = [];

          for (let i = 0; i < watermark * expectedNumChannels; i++) {
            var promise = new Promise((resolve, reject) => {
              var createSessionRequest = {database: _DATABASE};
              client.createSession(createSessionRequest, (err, session) => {
                if (err) {
                  reject(err);
                } else {
                  var executeSqlRequest = {
                    session: session.name,
                    sql: _TEST_SQL,
                  };
                  var call = client.executeStreamingSql(executeSqlRequest);

                  resolve({
                    call: call,
                    sessionName: session.name,
                  });
                }
              });
            });
            createCallPromises.push(promise);
          }

          Promise.all(createCallPromises)
            .then(
              (results) => {
                assert.strictEqual(
                  pool.channelRefs.length,
                  expectedNumChannels
                );
                assert.strictEqual(
                  pool.channelRefs[0].affinityCount,
                  watermark
                );
                assert.strictEqual(
                  pool.channelRefs[0].activeStreamsCount,
                  watermark
                );

                // Consume streaming calls.
                var emitterPromises = results.map(
                  (result) =>
                    new Promise((resolve) => {
                      result.call.on('data', (partialResultSet) => {
                        var value = partialResultSet.values[0].stringValue;
                        assert.strictEqual(value, 'payload');
                      });
                      result.call.on('end', () => {
                        var deleteSessionRequest = {name: result.sessionName};
                        client.deleteSession(deleteSessionRequest, (err) => {
                          assert.ifError(err);
                          resolve();
                        });
                      });
                    })
                );

                // Make sure all sessions get cleaned.
                return Promise.all(emitterPromises);
              },
              (error) => {
                done(error);
              }
            )
            .then(
              () => {
                assert.strictEqual(
                  pool.channelRefs.length,
                  expectedNumChannels
                );
                assert.strictEqual(pool.channelRefs[0].affinityCount, 0);
                assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);
                done();
              },
              (error) => {
                done(error);
              }
            );
        });

        it('Test invalid BOUND affinity', (done) => {
          var getSessionRequest = {name: 'wrong_name'};
          client.getSession(getSessionRequest, (err) => {
            assert(err);
            assert.strictEqual(
              err.message,
              '3 INVALID_ARGUMENT: Invalid GetSession request.'
            );
            done();
          });
        });

        it('Test invalid UNBIND affinity', (done) => {
          var deleteSessionRequest = {name: 'wrong_name'};
          client.deleteSession(deleteSessionRequest, (err) => {
            assert(err);
            assert.strictEqual(
              err.message,
              '3 INVALID_ARGUMENT: Invalid DeleteSession request.'
            );
            done();
          });
        });
      });

      describe('SpannerClient generated by google-gax', () => {
        const gaxGrpc = new gax.GrpcClient({grpc});
        const protos = gaxGrpc.loadProto(
          PROTO_DIR,
          'google/spanner/v1/spanner.proto'
        );
        const SpannerClient = protos.google.spanner.v1.Spanner;

        let client;
        let pool;

        beforeEach((done) => {
          var authFactory = new GoogleAuth();
          authFactory.getApplicationDefault((err, auth) => {
            assert.ifError(err);

            var scopes = [_OAUTH_SCOPE];
            auth = auth.createScoped(scopes);

            var sslCreds = grpc.credentials.createSsl();
            var callCreds = grpc.credentials.createFromGoogleCredential(auth);
            var channelCreds = grpc.credentials.combineChannelCredentials(
              sslCreds,
              callCreds
            );

            var apiDefinition = JSON.parse(fs.readFileSync(_CONFIG_FILE));
            var apiConfig = grpcGcp.createGcpApiConfig(apiDefinition);

            var channelOptions = {
              channelFactoryOverride: grpcGcp.gcpChannelFactoryOverride,
              callInvocationTransformer: grpcGcp.gcpCallInvocationTransformer,
              gcpApiConfig: apiConfig,
            };

            client = new SpannerClient(_TARGET, channelCreds, channelOptions);

            pool = client.getChannel();

            done();
          });
        });

        it('Test session operations', (done) => {
          client.createSession({database: _DATABASE}, (err, session) => {
            assert.ifError(err);
            var sessionName = session.name;

            client.getSession({name: sessionName}, (err, sessionResult) => {
              assert.ifError(err);
              assert.strictEqual(sessionResult.name, sessionName);

              client.listSessions({database: _DATABASE}, (err, response) => {
                assert.ifError(err);
                var sessionsList = response.sessions;
                var sessionNames = sessionsList.map((session) => session.name);
                assert(sessionNames.includes(sessionName));

                client.deleteSession({name: sessionName}, (err) => {
                  assert.ifError(err);
                  done();
                });
              });
            });
          });
        });

        it('Test executeSql', (done) => {
          client.createSession({database: _DATABASE}, (err, session) => {
            assert.ifError(err);
            var sessionName = session.name;

            assert.strictEqual(pool.channelRefs.length, 1);
            assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
            assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);

            var executeSqlRequest = {
              session: sessionName,
              sql: _TEST_SQL,
            };
            client.executeSql(executeSqlRequest, (err, resultSet) => {
              assert.ifError(err);
              assert.notStrictEqual(resultSet, null);
              var rowsList = resultSet.rows;
              var value = rowsList[0].values[0].stringValue;

              assert.strictEqual(value, 'payload');
              assert.strictEqual(pool.channelRefs.length, 1);
              assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
              assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);

              var deleteSessionRequest = {name: sessionName};
              client.deleteSession(deleteSessionRequest, (err) => {
                assert.ifError(err);
                assert.strictEqual(pool.channelRefs.length, 1);
                assert.strictEqual(pool.channelRefs[0].affinityCount, 0);
                assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);
                done();
              });
            });
          });
        });

        it('Test executeStreamingSql', (done) => {
          client.createSession({database: _DATABASE}, (err, session) => {
            assert.ifError(err);
            var sessionName = session.name;

            assert.strictEqual(pool.channelRefs.length, 1);
            assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
            assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);

            var executeSqlRequest = {
              session: sessionName,
              sql: _TEST_SQL,
            };
            var call = client.executeStreamingSql(executeSqlRequest);

            assert.strictEqual(pool.channelRefs.length, 1);
            assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
            assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 1);

            call.on('data', (partialResultSet) => {
              var value = partialResultSet.values[0].stringValue;
              assert.strictEqual(value, 'payload');
            });

            call.on('status', (status) => {
              assert.strictEqual(status.code, grpc.status.OK);
              assert.strictEqual(pool.channelRefs.length, 1);
              assert.strictEqual(pool.channelRefs[0].affinityCount, 1);
              assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);
            });

            call.on('end', function () {
              client.deleteSession({name: sessionName}, (err) => {
                assert.ifError(err);
                assert.strictEqual(pool.channelRefs.length, 1);
                assert.strictEqual(pool.channelRefs[0].affinityCount, 0);
                assert.strictEqual(pool.channelRefs[0].activeStreamsCount, 0);
                done();
              });
            });
          });
        });
      });
    });
  });
}
