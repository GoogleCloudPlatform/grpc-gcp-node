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
 * @fileoverview Description of this file.
 */

'use strict';

const assert = require('assert');
const grpc = require('grpc');
const {GoogleAuth} = require('google-auth-library');
const spanner_grpc = require('../google/spanner/v1/spanner_grpc_pb.js');
const spanner = require('../google/spanner/v1/spanner_pb.js');

const _TARGET = 'spanner.googleapis.com:443';
const _OAUTH_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const _DATABASE = 'projects/grpc-gcp/instances/sample/databases/benchmark';
const _TEST_SQL = 'select id from storage';

/**
 * Client to use to make requests to Spanner target.
 */
var client;

describe('Spanner integration tests', function() {
  before(function(done) {
    var authFactory = new GoogleAuth();
    authFactory.getApplicationDefault((err, auth) => {
      assert.ifError(err);

      if (auth.createScopedRequired && auth.createScopedRequired()) {
        var scopes = [_OAUTH_SCOPE];
        auth = auth.createScoped(scopes);
      }
      var sslCreds = grpc.credentials.createSsl();
      var callCreds = grpc.credentials.createFromGoogleCredential(auth);
      var channelCreds = grpc.credentials.combineChannelCredentials(
        sslCreds,
        callCreds
      );
      client = new spanner_grpc.SpannerClient(_TARGET, channelCreds);
      done();
    });
  });

  it('Test createSession, getSession, listSessions, deleteSession', function(done) {
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

        var deleteSessionRequest = new spanner.DeleteSessionRequest();
        deleteSessionRequest.setName(sessionName);

        client.deleteSession(deleteSessionRequest, err => {
          assert.ifError(err);
          done();
        });
      });
    });
  });

  it ('Test executeSql', function(done) {
    var createSessionRequest = new spanner.CreateSessionRequest();
    createSessionRequest.setDatabase(_DATABASE);
    client.createSession(createSessionRequest, (err, session) => {
      assert.ifError(err);
      var sessionName = session.getName();

      var executeSqlRequest = new spanner.ExecuteSqlRequest();
      executeSqlRequest.setSession(sessionName);
      executeSqlRequest.setSql(_TEST_SQL);

      client.executeSql(executeSqlRequest, (err, resultSet) => {
        assert.ifError(err);
        assert.notEqual(resultSet, null);
        var rowsList = resultSet.getRowsList();
        var value = rowsList[0].getValuesList()[0].getStringValue();
        assert.equal(value, 'payload');

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
