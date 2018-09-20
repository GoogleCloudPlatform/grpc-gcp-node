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

const grpc = require('grpc');
const _ = require('lodash');
const ChannelRef = require('./channel_ref');

const CLIENT_CHANNEL_ID = 'grpc_gcp.client_channel.id';

class GcpChannelFactory {
  constructor(address, credentials, options) {
    this._maxSize = 10;
    this._maxConcurrentStreamsLowWatermark = 100;
    var gcpApiConfig = options.gcpApiConfig;
    if (gcpApiConfig) {
      var channelPool = gcpApiConfig.channelPool;
      if (channelPool) {
        if (channelPool.maxSize) this._maxSize = channelPool.maxSize;
        if (channelPool._maxConcurrentStreamsLowWatermark) {
          this._maxConcurrentStreamsLowWatermark =
            channelPool._maxConcurrentStreamsLowWatermark;
        }
      }
      var affinityByMethod = gcpApiConfig.affinityByMethod;
      if (affinityByMethod) {
        this._affinityByMethod = affinityByMethod;
      }
    }
    this._options = _.omit(options, 'gcpApiConfig');
    this._affinityKeyToChannelRef = {};
    this._channelRefs = [];
    this._target = address;
    this._credentials = credentials;
    this._isClosed = false;
  }

  getAffinityByMethod() {
    return this._affinityByMethod;
  }

  getChannelRef(affinityKey) {
    if (affinityKey && this._affinityKeyToChannelRef[affinityKey]) {
      return this._affinityKeyToChannelRef[affinityKey];
    }
    var size = this._channelRefs.length;
    this._channelRefs.sort((ref1, ref2) => {
      return ref1.getActiveStreamsCount() - ref2.getActiveStreamsCount();
    });

    if (
      size > 0 &&
      this._channelRefs[0].getActiveStreamsCount() <
        this._maxConcurrentStreamsLowWatermark
    ) {
      return this._channelRefs[0];
    }

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

  close() {
    this._channelRefs.forEach(ref => {
      ref.getChannel().close();
    });
    this._isClosed = true;
  }

  getTarget() {
    return this._target;
  }

  getConnectivityState(tryToConnect) {}

  watchConnectivityState(currentState, deadline, callback) {}

  createCall(method, deadline, host, parentCall, propagateFlags) {}
}

module.exports = GcpChannelFactory;
