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

const assert = require('assert');
const getGrpcGcpObjects = require('../../build/src');

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
  return function () {
    count -= 1;
    if (count <= 0) {
      done();
    }
  };
}

for (const grpcLibName of ['grpc', '@grpc/grpc-js']) {
  describe('Using ' + grpcLibName, () => {
    const grpc = require(grpcLibName);
    const grpcGcp = getGrpcGcpObjects(grpc);

    const insecureCreds = grpc.credentials.createInsecure();

    describe('grpc-gcp channel factory tests', () => {
      describe('constructor', () => {
        it('should require a string for the first argument', () => {
          assert.doesNotThrow(() => {
            new grpcGcp.GcpChannelFactory('hostname', insecureCreds);
          });
          assert.throws(() => {
            new grpcGcp.GcpChannelFactory();
          }, TypeError);
          assert.throws(() => {
            new grpcGcp.GcpChannelFactory(5);
          });
        });
        it('should require a credential for the second argument', () => {
          assert.doesNotThrow(() => {
            new grpcGcp.GcpChannelFactory('hostname', insecureCreds);
          });
          assert.throws(() => {
            new grpcGcp.GcpChannelFactory('hostname', 5);
          });
          assert.throws(() => {
            new grpcGcp.GcpChannelFactory('hostname');
          });
        });
        it('should accept an object for the third argument', () => {
          assert.doesNotThrow(() => {
            new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {});
          });
          assert.throws(() => {
            new grpcGcp.GcpChannelFactory('hostname', insecureCreds, 'abc');
          });
        });
        it('should only accept objects with string or int values', () => {
          assert.doesNotThrow(() => {
            new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {
              key: 'value',
            });
          });
          assert.doesNotThrow(() => {
            new grpcGcp.GcpChannelFactory('hostname', insecureCreds, {key: 5});
          });
        });
        it('should succeed without the new keyword', () => {
          assert.doesNotThrow(() => {
            const channel = new grpcGcp.GcpChannelFactory(
              'hostname',
              insecureCreds
            );
            assert(channel instanceof grpcGcp.GcpChannelFactory);
          });
        });
      });
      describe('close', () => {
        let channel;
        beforeEach(() => {
          channel = new grpcGcp.GcpChannelFactory(
            'hostname',
            insecureCreds,
            {}
          );
        });
        it('should succeed silently', () => {
          assert.doesNotThrow(() => {
            channel.close();
          });
        });
        it('should be idempotent', () => {
          assert.doesNotThrow(() => {
            channel.close();
            channel.close();
          });
        });
      });
      describe('getTarget', () => {
        let channel;
        beforeEach(() => {
          channel = new grpcGcp.GcpChannelFactory(
            'hostname',
            insecureCreds,
            {}
          );
        });
        it('should return a string', () => {
          assert.strictEqual(typeof channel.getTarget(), 'string');
        });
      });
      describe('getConnectivityState', () => {
        let channel;
        beforeEach(() => {
          channel = new grpcGcp.GcpChannelFactory(
            'hostname',
            insecureCreds,
            {}
          );
        });
        it('should return IDLE for a new channel', () => {
          assert.strictEqual(
            channel.getConnectivityState(),
            grpc.connectivityState.IDLE
          );
        });
      });
      describe('watchConnectivityState', () => {
        let channel;
        beforeEach(() => {
          channel = new grpcGcp.GcpChannelFactory(
            'localhost',
            insecureCreds,
            {}
          );
        });
        afterEach(() => {
          channel.close();
        });
        it('should throw an error if no channels are available', done => {
          channel.channelRefs = [];
          channel.watchConnectivityState(0, new Date(), err => {
            assert(err instanceof Error);
            assert.strictEqual(
              err.message,
              'Cannot watch connectivity state because there are no channels.'
            );
            done();
          });
        });
        it('should resolve immediately if the state is different', done => {
          const fakeState = grpc.connectivityState.READY;
          channel.getConnectivityState = function () {
            return grpc.connectivityState.IDLE;
          };
          channel.watchConnectivityState(fakeState, 1000, err => {
            assert.ifError(err);
            done();
          });
        });
        it('should call channel.watchConnectivityState', done => {
          const fakeState = grpc.connectivityState.READY;
          channel.getConnectivityState = function () {
            return fakeState;
          };
          channel.channelRefs.forEach(channelRef => {
            channelRef.channel.getConnectivityState = function (connect) {
              assert.strictEqual(connect, false);
              return fakeState;
            };
            channelRef.channel.watchConnectivityState = function (s, d, cb) {
              assert.strictEqual(s, fakeState);
              assert.strictEqual(d, 1000);
              channel.getConnectivityState = function () {
                return grpc.connectivityState.IDLE;
              };
              setImmediate(cb);
            };
          });
          channel.watchConnectivityState(fakeState, 1000, done);
        });
      });
      describe('createCall', () => {
        let channel;
        beforeEach(() => {
          channel = new grpcGcp.GcpChannelFactory(
            'localhost',
            insecureCreds,
            {}
          );
        });
        afterEach(() => {
          channel.close();
        });
        it('should return grpc.Call', () => {
          assert.throws(() => {
            channel.createCall();
          }, TypeError);
          assert.throws(() => {
            channel.createCall('method');
          }, TypeError);
          assert.doesNotThrow(() => {
            channel.createCall('method', new Date());
          });
          assert.doesNotThrow(() => {
            channel.createCall('method', 0);
          });
          assert.doesNotThrow(() => {
            channel.createCall('method', new Date(), 'host_override');
          });
        });
      });
    });
  });
}
