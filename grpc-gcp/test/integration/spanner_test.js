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

const assert = require('assert');
const grpc = require('grpc');
const {GoogleAuth} = require('google-auth-library');
const spannerGrpc = require('../google/spanner/v1/spanner_grpc_pb.js');
const spanner = require('../google/spanner/v1/spanner_pb.js');

const _TARGET = 'spanner.googleapis.com:443';
const _OAUTH_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const _DATABASE = 'projects/grpc-gcp/instances/sample/databases/benchmark';
const _TEST_SQL = 'select id from storage';

const _MAX_SIZE = 10;
const _LOW_WATERMARK = 1;

const grpcGcp = require('../..');

var initApiConfig = function(apiConfig) {
  function addMethod(apiConfig, methodName, command, affinityKey) {
    var affinityConfig = new grpcGcp.AffinityConfig();
    affinityConfig.setCommand(command);
    affinityConfig.setAffinityKey(affinityKey);
    var methodConfig = new grpcGcp.MethodConfig();
    methodConfig.addName(methodName);
    methodConfig.setAffinity(affinityConfig);
    apiConfig.addMethod(methodConfig);
  }

  apiConfig.setChannelPool(
    new grpcGcp.ChannelPoolConfig({
      maxSize: _MAX_SIZE,
      maxConcurrentStreamsLowWatermark: _LOW_WATERMARK,
    })
  );

  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/CreateSession',
    grpcGcp.AffinityConfig.Command.BIND,
    'name'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/GetSession',
    grpcGcp.AffinityConfig.Command.BOUND,
    'name'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/DeleteSession',
    grpcGcp.AffinityConfig.Command.UNBIND,
    'name'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/ExecuteSql',
    grpcGcp.AffinityConfig.Command.BOUND,
    'session'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/ExecuteStreamingSql',
    grpcGcp.AffinityConfig.Command.BOUND,
    'session'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/Read',
    grpcGcp.AffinityConfig.Command.BOUND,
    'session'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/StreamingRead',
    grpcGcp.AffinityConfig.Command.BOUND,
    'session'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/BeginTransaction',
    grpcGcp.AffinityConfig.Command.BOUND,
    'session'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/Commit',
    grpcGcp.AffinityConfig.Command.BOUND,
    'session'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/Rollback',
    grpcGcp.AffinityConfig.Command.BOUND,
    'session'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/PartitionQuery',
    grpcGcp.AffinityConfig.Command.BOUND,
    'session'
  );
  addMethod(
    apiConfig,
    '/google.spanner.v1.Spanner/PartitionRead',
    grpcGcp.AffinityConfig.Command.BOUND,
    'session'
  );
};

describe('Spanner integration tests', () => {
  let client;
  let pool;

  beforeEach(done => {
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

      var apiConfig = new grpcGcp.ApiConfig();
      initApiConfig(apiConfig);

      var channelOptions = {
        channelFactoryOverride: grpcGcp.gcpChannelFactoryOverride,
        callInvocationTransformer: grpcGcp.gcpCallInvocationTransformer,
        gcpApiConfig: apiConfig,
      };

      client = new spannerGrpc.SpannerClient(
        _TARGET,
        channelCreds,
        channelOptions
      );

      pool = client.getChannel();

      done();
    });
  });

  it('Test create, get, list, delete session', done => {
    var createSessionRequest = new spanner.CreateSessionRequest();
    createSessionRequest.setDatabase(_DATABASE);
    client.createSession(createSessionRequest, (err, session) => {
      assert.ifError(err);
      var sessionName = session.getName();

      var getSessionRequest = new spanner.GetSessionRequest();
      getSessionRequest.setName(sessionName);

      client.getSession(getSessionRequest, (err, sessionResult) => {
        assert.ifError(err);
        assert.strictEqual(sessionResult.getName(), sessionName);

        var listSessionsRequest = new spanner.ListSessionsRequest();
        listSessionsRequest.setDatabase(_DATABASE);
        client.listSessions(listSessionsRequest, (err, response) => {
          assert.ifError(err);
          var sessionsList = response.getSessionsList();
          var sessionNames = sessionsList.map(session => session.getName());
          assert(sessionNames.includes(sessionName));

          var deleteSessionRequest = new spanner.DeleteSessionRequest();
          deleteSessionRequest.setName(sessionName);
          client.deleteSession(deleteSessionRequest, err => {
            assert.ifError(err);
            done();
          });
        });
      });
    });
  });

  it('Test executeSql', done => {
    var createSessionRequest = new spanner.CreateSessionRequest();
    createSessionRequest.setDatabase(_DATABASE);
    client.createSession(createSessionRequest, (err, session) => {
      assert.ifError(err);
      var sessionName = session.getName();

      assert.strictEqual(pool._channelRefs.length, 1);
      assert.strictEqual(pool._channelRefs[0]._affinityCount, 1);
      assert.strictEqual(pool._channelRefs[0]._activeStreamsCount, 0);

      var executeSqlRequest = new spanner.ExecuteSqlRequest();
      executeSqlRequest.setSession(sessionName);
      executeSqlRequest.setSql(_TEST_SQL);
      client.executeSql(executeSqlRequest, (err, resultSet) => {
        assert.ifError(err);
        assert.notStrictEqual(resultSet, null);
        var rowsList = resultSet.getRowsList();
        var value = rowsList[0].getValuesList()[0].getStringValue();

        assert.strictEqual(value, 'payload');
        assert.strictEqual(pool._channelRefs.length, 1);
        assert.strictEqual(pool._channelRefs[0]._affinityCount, 1);
        assert.strictEqual(pool._channelRefs[0]._activeStreamsCount, 0);

        var deleteSessionRequest = new spanner.DeleteSessionRequest();
        deleteSessionRequest.setName(sessionName);

        client.deleteSession(deleteSessionRequest, err => {
          assert.ifError(err);
          assert.strictEqual(pool._channelRefs.length, 1);
          assert.strictEqual(pool._channelRefs[0]._affinityCount, 0);
          assert.strictEqual(pool._channelRefs[0]._activeStreamsCount, 0);
          done();
        });
      });
    });
  });

  it('Test executeStreamingSql', done => {
    var createSessionRequest = new spanner.CreateSessionRequest();
    createSessionRequest.setDatabase(_DATABASE);
    client.createSession(createSessionRequest, (err, session) => {
      assert.ifError(err);
      var sessionName = session.getName();

      assert.strictEqual(pool._channelRefs.length, 1);
      assert.strictEqual(pool._channelRefs[0]._affinityCount, 1);
      assert.strictEqual(pool._channelRefs[0]._activeStreamsCount, 0);

      var executeSqlRequest = new spanner.ExecuteSqlRequest();
      executeSqlRequest.setSession(sessionName);
      executeSqlRequest.setSql(_TEST_SQL);
      var call = client.executeStreamingSql(executeSqlRequest);

      assert.strictEqual(pool._channelRefs.length, 1);
      assert.strictEqual(pool._channelRefs[0]._affinityCount, 1);
      assert.strictEqual(pool._channelRefs[0]._activeStreamsCount, 1);

      call.on('data', partialResultSet => {
        var value = partialResultSet.getValuesList()[0].getStringValue();
        assert.strictEqual(value, 'payload');
      });

      call.on('status', status => {
        assert.strictEqual(status.code, grpc.status.OK);
        assert.strictEqual(pool._channelRefs.length, 1);
        assert.strictEqual(pool._channelRefs[0]._affinityCount, 1);
        assert.strictEqual(pool._channelRefs[0]._activeStreamsCount, 0);
      });

      call.on('end', function() {
        var deleteSessionRequest = new spanner.DeleteSessionRequest();
        deleteSessionRequest.setName(sessionName);
        client.deleteSession(deleteSessionRequest, err => {
          assert.ifError(err);
          assert.strictEqual(pool._channelRefs.length, 1);
          assert.strictEqual(pool._channelRefs[0]._affinityCount, 0);
          assert.strictEqual(pool._channelRefs[0]._activeStreamsCount, 0);
          done();
        });
      });
    });
  });

  it('Test concurrent streams wartermark', done => {
    var watermark = 5;
    pool._maxConcurrentStreamsLowWatermark = watermark;

    var expectedNumChannels = 3;

    var createCallPromises = [];

    for (let i = 0; i < watermark * expectedNumChannels; i++) {
      var promise = new Promise((resolve, reject) => {
        var createSessionRequest = new spanner.CreateSessionRequest();
        createSessionRequest.setDatabase(_DATABASE);
        client.createSession(createSessionRequest, (err, session) => {
          if (err) {
            reject(err);
          } else {
            var executeSqlRequest = new spanner.ExecuteSqlRequest();
            executeSqlRequest.setSession(session.getName());
            executeSqlRequest.setSql(_TEST_SQL);
            var call = client.executeStreamingSql(executeSqlRequest);

            resolve({
              call: call,
              sessionName: session.getName(),
            });
          }
        });
      });
      createCallPromises.push(promise);
    }

    Promise.all(createCallPromises).then(results => {
      assert.strictEqual(pool._channelRefs.length, expectedNumChannels);
      assert.strictEqual(pool._channelRefs[0]._affinityCount, watermark);
      assert.strictEqual(pool._channelRefs[0]._activeStreamsCount, watermark);

      // Consume streaming calls.
      var emitterPromises = results.map(
        result =>
          new Promise(resolve => {
            result.call.on('data', partialResultSet => {
              var value = partialResultSet.getValuesList()[0].getStringValue();
              assert.strictEqual(value, 'payload');
            });
            result.call.on('end', () => {
              var deleteSessionRequest = new spanner.DeleteSessionRequest();
              deleteSessionRequest.setName(result.sessionName);
              client.deleteSession(deleteSessionRequest, err => {
                assert.ifError(err);
                resolve();
              });
            });
          })
      );

      // Make sure all sessions get cleaned.
      Promise.all(emitterPromises).then(() => {
        assert.strictEqual(pool._channelRefs.length, expectedNumChannels);
        assert.strictEqual(pool._channelRefs[0]._affinityCount, 0);
        assert.strictEqual(pool._channelRefs[0]._activeStreamsCount, 0);
        done();
      });
    });
  });
});
