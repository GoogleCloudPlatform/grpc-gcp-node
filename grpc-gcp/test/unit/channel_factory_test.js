/*
 *
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

'use strict';

var assert = require('assert');
const grpc = require('grpc');
const grpcGcp = require('../../build/src');

/**
 * This is used for testing functions with multiple asynchronous calls that
 * can happen in different orders. This should be passed the number of async
 * function invocations that can occur last, and each of those should call this
 * function's return value
 * @param {function()} done The function that should be called when a test is
 *     complete.
 * @param {number} count The number of calls to the resulting function if the
 *     test passes.
 * @return {function()} The function that should be called at the end of each
 *     sequence of asynchronous functions.
 */
function multiDone(done, count) {
  return function() {
    count -= 1;
    if (count <= 0) {
      done();
    }
  };
}
var insecureCreds = grpc.credentials.createInsecure();

describe('grpc-gcp channel factory tests', function() {
  describe('constructor', function() {
    it('should require a string for the first argument', function() {
      assert.doesNotThrow(function() {
        new grpcGcp.GcpChannelFactory('hostname', insecureCreds);
      });
      assert.throws(function() {
        new grpcGcp.GcpChannelFactory();
      }, TypeError);
      assert.throws(function() {
        new grpcGcp.GcpChannelFactory(5);
      });
    });
    it('should require a credential for the second argument', function() {
      assert.doesNotThrow(function() {
        new grpcGcp.GcpChannelFactory('hostname', insecureCreds);
      });
      assert.throws(function() {
        new grpcGcp.GcpChannelFactory('hostname', 5);
      });
      assert.throws(function() {
        new grpcGcp.GcpChannelFactory('hostname');
      });
    });
    it('should accept an object for the third argument', function() {
      assert.doesNotThrow(function() {
        new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {});
      });
      assert.throws(function() {
        new grpcGcp.GcpChannelFactory('hostname', insecureCreds, 'abc');
      });
    });
    it('should only accept objects with string or int values', function() {
      assert.doesNotThrow(function() {
        new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {
          key: 'value',
        });
      });
      assert.doesNotThrow(function() {
        new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {key: 5});
      });
      assert.throws(function() {
        new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {key: null});
      });
      assert.throws(function() {
        new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {
          key: new Date(),
        });
      });
    });
    it('should succeed without the new keyword', function() {
      assert.doesNotThrow(function() {
        var channel = new grpcGcp.GcpChannelFactory('hostname', insecureCreds);
        assert(channel instanceof grpcGcp.GcpChannelFactory);
      });
    });
  });
  describe('close', function() {
    var channel;
    beforeEach(function() {
      channel = new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {});
    });
    it('should succeed silently', function() {
      assert.doesNotThrow(function() {
        channel.close();
      });
    });
    it('should be idempotent', function() {
      assert.doesNotThrow(function() {
        channel.close();
        channel.close();
      });
    });
  });
  describe('getTarget', function() {
    var channel;
    beforeEach(function() {
      channel = new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {});
    });
    it('should return a string', function() {
      assert.strictEqual(typeof channel.getTarget(), 'string');
    });
  });
  describe('getConnectivityState', function() {
    var channel;
    beforeEach(function() {
      channel = new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {});
    });
    it('should return IDLE for a new channel', function() {
      assert.strictEqual(
        channel.getConnectivityState(),
        grpc.connectivityState.IDLE
      );
    });
  });
  describe('watchConnectivityState', function() {
    var channel;
    beforeEach(function() {
      channel = new grpcGcp.GcpChannelFactory('localhost', insecureCreds, {});
    });
    afterEach(function() {
      channel.close();
    });
    it('should throw an error if no channels are available', function(done) {
      channel.channelRefs = [];
      channel.watchConnectivityState(0, new Date(), function(err) {
        assert(err instanceof Error);
        assert.strictEqual(
          err.message,
          'Cannot watch connectivity state because there are no channels.');
        done();
      });
    });
    it('should resolve immediately if the state is different', function(done) {
      var fakeState = grpc.connectivityState.READY;
      channel.getConnectivityState = function() {
        return grpc.connectivityState.IDLE;
      };
      channel.watchConnectivityState(fakeState, 1000, function(err) {
        assert.ifError(err);
        done();
      });
    });
    it('should call channel.watchConnectivityState', function(done) {
      var fakeState = grpc.connectivityState.READY;
      channel.getConnectivityState = function() {
        return fakeState;
      };
      channel.channelRefs.forEach(channelRef => {
        channelRef.channel.watchConnectivityState = function(s, d, cb) {
          channel.getConnectivityState = function() {
            return grpc.connectivityState.IDLE;
          };
          setImmediate(cb);
        };
      });
      channel.watchConnectivityState(fakeState, 1000, done);
    });
  });
  describe('createCall', function() {
    var channel;
    beforeEach(function() {
      channel = new grpcGcp.GcpChannelFactory('localhost', insecureCreds, {});
    });
    afterEach(function() {
      channel.close();
    });
    it('should return grpc.Call', function() {
      assert.throws(function() {
        channel.createCall();
      }, TypeError);
      assert.throws(function() {
        channel.createCall('method');
      }, TypeError);
      assert.doesNotThrow(function() {
        channel.createCall('method', new Date());
      });
      assert.doesNotThrow(function() {
        channel.createCall('method', 0);
      });
      assert.doesNotThrow(function() {
        channel.createCall('method', new Date(), 'host_override');
      });
    });
  });
});
