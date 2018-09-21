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
      if (gcpApiConfig.hasChannelPool()) {
        var channelPool = gcpApiConfig.getChannelPool();
        if (channelPool.getMaxSize()) this._maxSize = channelPool.getMaxSize();
        if (channelPool.getMaxConcurrentStreamsLowWatermark()) {
          this._maxConcurrentStreamsLowWatermark = channelPool.getMaxConcurrentStreamsLowWatermark();
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
    // this._lock = new AsyncLock();
  }

  _initMethodToAffinityMap(gcpApiConfig) {
    var map = {};
    var methodList = gcpApiConfig.getMethodList();
    methodList.forEach(method => {
      var nameList = method.getNameList();
      nameList.forEach(methodName => {
        if (method.hasAffinity()) map[methodName] = method.getAffinity();
      });
    });
    return map;
  }

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

  getAffinityConfig(methodName) {
    return this._methodToAffinity[methodName];
  }

  bind(channelRef, affinityKey) {
    var existingChannelRef = this._affinityKeyToChannelRef[affinityKey];
    if (existingChannelRef) {
      existingChannelRef.affinityCountIncr();
    } else {
      this._affinityKeyToChannelRef[affinityKey] = channelRef;
    }
  }

  unbind(boundKey) {
    var boundChannelRef = this._affinityKeyToChannelRef[boundKey];
    if (boundChannelRef) {
      boundChannelRef.affinityCountDecr();
      if (boundChannelRef.getAffinityCount() <= 0) {
        delete this._affinityKeyToChannelRef[boundKey];
      }
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
