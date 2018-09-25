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

const {
  ApiConfig,
  ChannelPoolConfig,
  AffinityConfig,
  MethodConfig,
} = require('./src/generated/grpc_gcp_pb');
const GcpChannelFactory = require('./src/gcp_channel_factory');
const grpc = require('grpc');

const util = require('util');
const _ = require('lodash');

exports.GcpChannelFactory = GcpChannelFactory;

exports.ApiConfig = ApiConfig;
exports.ChannelPoolConfig = ChannelPoolConfig;
exports.AffinityConfig = AffinityConfig;
exports.MethodConfig = MethodConfig;

/**
 * Function for creating a gcp channel factory.
 * @memberof grpc-gcp
 * @param {string} address The address of the server to connect to.
 * @param {grpc.ChannelCredentials} credentials Channel credentials to use when connecting
 * @param {grpc~ChannelOptions} options A map of channel options that will be passed to the core.
 * @return {GcpChannelFactory} A GcpChannelFactory instance.
 */
exports.gcpChannelFactoryOverride = function(
  address,
  credentials,
  channelOptions
) {
  return new GcpChannelFactory(address, credentials, channelOptions);
};

/**
 * Pass in call properties and return a new object with modified values.
 * @memberof grpc-gcp
 * @param {Object=} callProperties Options to apply to the loaded file
 * @param {Object=} [callProperties.argument] The argument to the method.
 *     Only available for unary and server-streaming methods.
 * @param {Object=} [callProperties.metadata] The metadata that will be
 *     sent with the method.
 * @param {Object=} [callProperties.call] The call object that will be
 *     returned by the method.
 * @param {Object=} [callProperties.channel] The channel object that will
 *     be used to transmit the request.
 * @param {Object=} [callProperties.methodDefinition] An object describing
 *     the request method.
 * @param {Object=} [callProperties.callOptions] The options object passed
 *     to the call
 * @param {Function=} [callProperties.callback] Callback function to be
 *     appended in intercepting call.
 * @return {Object} Modified call properties.
 */
exports.gcpCallInvocationTransformer = function(callProperties) {
  var channelFactory = callProperties.channel;
  if (!channelFactory || !(channelFactory instanceof GcpChannelFactory)) {
    // The gcpCallInvocationTransformer needs to use gcp channel factory.
    return callProperties;
  }

  var argument = callProperties.argument;
  var metadata = callProperties.metadata;
  var call = callProperties.call;
  var methodDefinition = callProperties.methodDefinition;
  var path = methodDefinition.path;
  var callOptions = callProperties.callOptions;
  var callback = callProperties.callback;

  var preProcessResult = preProcess(channelFactory, path, argument);
  var channelRef = preProcessResult.channelRef;

  // callProperties.call.on('status', status => {
  //   channelRef.activeStreamsCountDecr();
  // });

  var boundKey = preProcessResult.boundKey;
  var postProcessArgs = {
    channelFactory: channelFactory,
    channelRef: channelRef,
    boundKey: boundKey,
    path: path,
  };

  var interceptor = function(options, nextCall) {
    var channelFactory;
    var channelRef;
    var boundKey;
    var path;
    if (options.postProcessArgs) {
      channelFactory = options.postProcessArgs.channelFactory;
      channelRef = options.postProcessArgs.channelRef;
      boundKey = options.postProcessArgs.boundKey;
      path = options.postProcessArgs.path;
    }
    options = _.omit(options, 'postProcessArgs');

    var savedMessage;

    var requester = {
      start: function(metadata, listener, next) {
        var newListener = {
          onReceiveMetadata: function(metadata, next) {
            next(metadata);
          },
          onReceiveMessage: function(message, next) {
            savedMessage = message;
            next(message);
          },
          onReceiveStatus: function(status, next) {
            if (status.code === grpc.status.OK) {
              postProcess(
                channelFactory,
                channelRef,
                path,
                boundKey,
                savedMessage
              );
            }
            next(status);
          },
        };
        next(metadata, newListener);
      },
      sendMessage: function(message, next) {
        next(message);
      },
      halfClose: function(next) {
        next();
      },
      cancel: function(message, next) {
        next();
      },
    };
    return new grpc.InterceptingCall(nextCall(options), requester);
  };

  // Append interceptor to existing interceptors list.
  var newCallOptions = _.merge(callOptions, {postProcessArgs: postProcessArgs});
  var interceptors = callOptions.interceptors;
  if (!interceptors) interceptors = [];
  newCallOptions.interceptors = interceptors.concat([interceptor]);

  return {
    argument: argument,
    metadata: metadata,
    call: call,
    channel: channelRef.getChannel(),
    methodDefinition: methodDefinition,
    callOptions: newCallOptions,
    callback: callback,
  };
};

var preProcess = function(channelFactory, path, argument) {
  var affinityConfig = channelFactory.getAffinityConfig(path);
  var affinityKey;
  if (argument && affinityConfig && affinityConfig.getCommand()) {
    let command = affinityConfig.getCommand();
    if (
      command === AffinityConfig.Command.BOUND ||
      command === AffinityConfig.Command.UNBIND
    ) {
      affinityKey = getAffinityKeyFromMessage(
        affinityConfig.getAffinityKey(),
        argument
      );
    }
  }
  var channelRef = channelFactory.getChannelRef(affinityKey);
  channelRef.activeStreamsCountIncr();
  return {
    boundKey: affinityKey,
    channelRef: channelRef,
  };
};

var postProcess = function(
  channelFactory,
  channelRef,
  path,
  boundKey,
  responseMsg
) {
  if (!channelFactory || !responseMsg) return;
  var affinityConfig = channelFactory.getAffinityConfig(path);
  if (affinityConfig && affinityConfig.getCommand()) {
    var command = affinityConfig.getCommand();
    if (command === AffinityConfig.Command.BIND) {
      var affinityKey = getAffinityKeyFromMessage(
        affinityConfig.getAffinityKey(),
        responseMsg
      );
      channelFactory.bind(channelRef, affinityKey);
    } else if (command === AffinityConfig.Command.UNBIND) {
      channelFactory.unbind(boundKey);
    }
  }
  channelRef.activeStreamsCountDecr();
};

var getAffinityKeyFromMessage = function(affinityKeyName, message) {
  if (!affinityKeyName) {
    throw new Error('Cannot find affinity_key in proto message.');
  }
  var currMessage = message;
  var names = affinityKeyName.split('.');
  if (names) {
    names.forEach(name => {
      let getter = 'get' + name.charAt(0).toUpperCase() + name.substr(1);
      currMessage = currMessage[getter]();
    });
    if (currMessage) return currMessage;
  }
  throw new Error(
    util.format(
      'Cannot find affinity value from proto message using affinity_key: %s.',
      affinityKeyName
    )
  );
};
