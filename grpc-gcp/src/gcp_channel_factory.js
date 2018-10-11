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

'use strict';

const grpc = require('grpc');
const _ = require('lodash');
const ChannelRef = require('./channel_ref');

const CLIENT_CHANNEL_ID = 'grpc_gcp.client_channel.id';

/**
 * A channel management factory that implements grpc.Channel APIs.
 */
class GcpChannelFactory {
  /**
   * @param {string} address The address of the server to connect to.
   * @param {grpc.ChannelCredentials} credentials Channel credentials to use when connecting
   * @param {object} options A map of channel options.
   */
  constructor(address, credentials, options) {
    if (!options) {
      options = {};
    }
    if (typeof options !== 'object') {
      throw new TypeError(
        'Channel options must be an object with string keys and integer or string values'
      );
    }
    this._maxSize = 10;
    this._maxConcurrentStreamsLowWatermark = 100;
    var gcpApiConfig = options.gcpApiConfig;
    if (gcpApiConfig) {
      if (gcpApiConfig.channelPool) {
        var channelPool = gcpApiConfig.channelPool;
        if (channelPool.maxSize) this._maxSize = channelPool.maxSize;
        if (channelPool.maxConcurrentStreamsLowWatermark) {
          this._maxConcurrentStreamsLowWatermark =
            channelPool.maxConcurrentStreamsLowWatermark;
        }
      }
      this._methodToAffinity = this._initMethodToAffinityMap(gcpApiConfig);
    }
    this._options = _.omit(options, 'gcpApiConfig');
    this._affinityKeyToChannelRef = {};
    this._channelRefs = [];
    this._target = address;
    this._credentials = credentials;
    this._isClosed = false;
    // Initialize channel in the pool to avoid empty pool.
    this.getChannelRef();
  }

  _initMethodToAffinityMap(gcpApiConfig) {
    var map = {};
    var methodList = gcpApiConfig.method;
    methodList.forEach(method => {
      var nameList = method.name;
      nameList.forEach(methodName => {
        if (method.affinity) map[methodName] = method.affinity;
      });
    });
    return map;
  }

  /**
   * Picks a grpc channel from the pool and wraps it with ChannelRef.
   * @param {string=} affinityKey Affinity key to get the bound channel.
   * @return {ChannelRef} Wrapper containing the grpc channel.
   */
  getChannelRef(affinityKey) {
    if (affinityKey && this._affinityKeyToChannelRef[affinityKey]) {
      // Chose an bound channel if affinityKey is specified.
      return this._affinityKeyToChannelRef[affinityKey];
    }

    // Sort channel refs by active streams count.
    this._channelRefs.sort((ref1, ref2) => {
      return ref1.getActiveStreamsCount() - ref2.getActiveStreamsCount();
    });

    var size = this._channelRefs.length;
    // Chose the channelRef that has the least busy channel.
    if (
      size > 0 &&
      this._channelRefs[0].getActiveStreamsCount() <
        this._maxConcurrentStreamsLowWatermark
    ) {
      return this._channelRefs[0];
    }

    // If all existing channels are busy, and channel pool still has capacity,
    // create a new channel in the pool.
    if (size < this._maxSize) {
      var channelOptions = {[CLIENT_CHANNEL_ID]: size};
      _.merge(channelOptions, this._options);
      var grpcChannel = new grpc.Channel(
        this._target,
        this._credentials,
        channelOptions
      );
      var channelRef = new ChannelRef(grpcChannel, size);
      this._channelRefs.push(channelRef);
      return channelRef;
    } else {
      return this._channelRefs[0];
    }
  }

  /**
   * Get AffinityConfig associated with a certain method.
   * @param {string} methodName Method name of the request.
   */
  getAffinityConfig(methodName) {
    return this._methodToAffinity[methodName];
  }

  /**
   * Bind channel with affinity key.
   * @param {ChannelRef} channelRef ChannelRef instance that contains the grpc channel.
   * @param {string} affinityKey The affinity key used for binding the channel.
   */
  bind(channelRef, affinityKey) {
    if (!affinityKey || !channelRef) return;
    var existingChannelRef = this._affinityKeyToChannelRef[affinityKey];
    if (!existingChannelRef) {
      this._affinityKeyToChannelRef[affinityKey] = channelRef;
    }
    this._affinityKeyToChannelRef[affinityKey].affinityCountIncr();
  }

  /**
   * Unbind channel with affinity key.
   * @param {string} boundKey Affinity key bound to a channel.
   */
  unbind(boundKey) {
    if (!boundKey) return;
    var boundChannelRef = this._affinityKeyToChannelRef[boundKey];
    if (boundChannelRef) {
      boundChannelRef.affinityCountDecr();
      if (boundChannelRef.getAffinityCount() <= 0) {
        delete this._affinityKeyToChannelRef[boundKey];
      }
    }
  }

  /**
   * Close all channels in the channel pool.
   */
  close() {
    this._channelRefs.forEach(ref => {
      ref.getChannel().close();
    });
  }

  getTarget() {
    return this._target;
  }

  /**
   * Get the current connectivity state of the channel pool.
   * @param {*} tryToConnect If true, the channel will start connecting if it is
   *     idle. Otherwise, idle channels will only start connecting when a
   *     call starts.
   */
  getConnectivityState(tryToConnect) {
    var ready = 0;
    var idle = 0;
    var connecting = 0;
    var transientFailure = 0;
    var shutdown = 0;

    for (let i = 0; i < this._channelRefs.length; i++) {
      var grpcChannel = this._channelRefs[i].getChannel();
      var state = grpcChannel.getConnectivityState(tryToConnect);
      switch (state) {
        case grpc.connectivityState.READY:
          ready++;
          break;
        case grpc.connectivityState.SHUTDOWN:
          shutdown++;
          break;
        case grpc.connectivityState.TRANSIENT_FAILURE:
          transientFailure++;
          break;
        case grpc.connectivityState.CONNECTING:
          connecting++;
          break;
        case grpc.connectivityState.IDLE:
          idle++;
          break;
      }
    }

    if (ready > 0) {
      return grpc.connectivityState.READY;
    } else if (connecting > 0) {
      return grpc.connectivityState.CONNECTING;
    } else if (transientFailure > 0) {
      return grpc.connectivityState.TRANSIENT_FAILURE;
    } else if (idle > 0) {
      return grpc.connectivityState.IDLE;
    } else if (shutdown > 0) {
      return grpc.connectivityState.SHUTDOWN;
    }

    throw new Error(
      'Cannot get connectivity state because no channel provides valid state.'
    );
  }

  /**
   * Watch for connectivity state changes. Currently This function will throw
   * not implemented error because the implementation requires lot of work but
   * has little use cases.
   * @param {grpc.ConnectivityState} currentState The state to watch for
   *     transitions from. This should always be populated by calling
   *     getConnectivityState immediately before.
   * @param {grpc~Deadline} deadline A deadline for waiting for a state change
   * @param {grpc.Channel~watchConnectivityStateCallback} callback Called with no
   *     error when the state changes, or with an error if the deadline passes
   *     without a state change
   */
  watchConnectivityState(currentState, deadline, callback) {
    throw new Error('Function watchConnectivityState not implemented!');
  }

  /**
   * Create a call object. This function will not be called when using
   *     grpc.Client class. But since it's a public function of grpc.Channel,
   *     It needs to be implemented for potential use cases.
   * @param {string} method The full method string to request.
   * @param {grpc~Deadline} deadline The call deadline.
   * @param {string|null} host A host string override for making the request.
   * @param {grpc~Call|null} parentCall A server call to propagate some
   *     information from.
   * @param {number|null} propagateFlags A bitwise combination of elements of
   *     {@link grpc.propagate} that indicates what information to propagate
   *     from parentCall.
   * @return {grpc~Call}
   */
  createCall(method, deadline, host, parentCall, propagateFlags) {
    var grpcChannel = this.getChannelRef().getChannel();
    return grpcChannel.createCall(
      method,
      deadline,
      host,
      parentCall,
      propagateFlags
    );
  }
}

module.exports = GcpChannelFactory;
