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

const GcpChannelFactory = require('./src/gcp_channel_factory');

const grpc = require('grpc');
const util = require('util');
const _ = require('lodash');
const protobuf = require('protobufjs');

const PROTO_PATH = __dirname + '/protos/grpc_gcp.proto';

var protoRoot = protobuf.loadSync(PROTO_PATH);
const ApiConfig = protoRoot.lookupType('grpc.gcp.ApiConfig');
const AffinityConfig = protoRoot.lookupType('grpc.gcp.AffinityConfig');

/**
 * Create ApiConfig proto message from config object.
 * @param {object} apiDefinition Api object that specifies channel pool configuation.
 * @return {protobuf.Message} A protobuf message type.
 */
exports.createGcpApiConfig = function(apiDefinition) {
  var apiConfigMsg = ApiConfig.fromObject(apiDefinition);
  return apiConfigMsg;
};

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
 * This function will be used together with gcpChannelFactoryOverride
 * when constructing a grpc Client.
 * @memberof grpc-gcp
 * @param {object} callProperties Call properties.
 * @param {object=} [callProperties.argument] The argument to the method.
 *     Only available for unary and server-streaming methods.
 * @param {object=} [callProperties.metadata] The metadata that will be
 *     sent with the method.
 * @param {object=} [callProperties.call] The call object that will be
 *     returned by the method.
 * @param {object=} [callProperties.channel] The channel object that will
 *     be used to transmit the request.
 * @param {object=} [callProperties.methodDefinition] An object describing
 *     the request method.
 * @param {object=} [callProperties.callOptions] The options object passed
 *     to the call
 * @param {function=} [callProperties.callback] Callback function to be
 *     appended in intercepting call.
 * @return {object} Modified call properties.
 */
exports.gcpCallInvocationTransformer = function(callProperties) {
  if (!callProperties) {
    callProperties = {};
  }
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

  var boundKey = preProcessResult.boundKey;

  var postProcessInterceptor = function(options, nextCall) {
    var firstMessage;

    var requester = {
      start: function(metadata, listener, next) {
        var newListener = {
          onReceiveMetadata: function(metadata, next) {
            next(metadata);
          },
          onReceiveMessage: function(message, next) {
            if (!firstMessage) firstMessage = message;
            next(message);
          },
          onReceiveStatus: function(status, next) {
            if (status.code === grpc.status.OK) {
              postProcess(
                channelFactory,
                channelRef,
                path,
                boundKey,
                firstMessage
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
  var newCallOptions = {};
  _.assign(newCallOptions, callOptions);
  var interceptors = callOptions.interceptors ? callOptions.interceptors : [];
  newCallOptions.interceptors = interceptors.concat([postProcessInterceptor]);

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

/**
 * Handle channel affinity and pick a channel before call starts.
 * @param {GcpChannelFactory} channelFactory The channel management factory.
 * @param {string} path Method path.
 * @param {object=} argument The request arguments object.
 * @return {object} Result containing bound affinity key and the chosen channel ref object.
 */
var preProcess = function(channelFactory, path, argument) {
  var affinityConfig = channelFactory.getAffinityConfig(path);
  var affinityKey;
  if (argument && affinityConfig && affinityConfig.command) {
    let command = affinityConfig.command;
    if (
      command === AffinityConfig.Command.BOUND ||
      command === AffinityConfig.Command.UNBIND
    ) {
      affinityKey = getAffinityKeyFromMessage(
        affinityConfig.affinityKey,
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

/**
 * Handle channel affinity and streams count after call is done.
 * @param {GcpChannelFactory} channelFactory The channel management factory.
 * @param {ChannelRef} channelRef ChannelRef instance that contains a real grpc channel.
 * @param {string} path Method path.
 * @param {string=} boundKey Affinity key bound to a channel.
 * @param {object=} responseMsg Response proto message.
 */
var postProcess = function(
  channelFactory,
  channelRef,
  path,
  boundKey,
  responseMsg
) {
  if (!channelFactory || !responseMsg) return;
  var affinityConfig = channelFactory.getAffinityConfig(path);
  if (affinityConfig && affinityConfig.command) {
    var command = affinityConfig.command;
    if (command === AffinityConfig.Command.BIND) {
      var affinityKey = getAffinityKeyFromMessage(
        affinityConfig.affinityKey,
        responseMsg
      );
      channelFactory.bind(channelRef, affinityKey);
    } else if (command === AffinityConfig.Command.UNBIND) {
      channelFactory.unbind(boundKey);
    }
  }
  channelRef.activeStreamsCountDecr();
};

/**
 * Retrieve affinity key specified in the proto message.
 * @param {string} affinityKeyName affinity key locator.
 * @param {object} message proto message that contains affinity info.
 * @return {string} Affinity key string.
 */
var getAffinityKeyFromMessage = function(affinityKeyName, message) {
  if (affinityKeyName) {
    var currMessage = message;
    var names = affinityKeyName.split('.');
    var i = 0;
    for (; i < names.length; i++) {
      let getter =
        'get' + names[i].charAt(0).toUpperCase() + names[i].substr(1);
      if (!currMessage || typeof currMessage[getter] !== 'function') break;
      currMessage = currMessage[getter]();
    }
    if (i !== 0 && i === names.length) return currMessage;
  }
  console.error(
    util.format(
      'Cannot find affinity value from proto message using affinity_key: %s.',
      affinityKeyName
    )
  );
  return '';
};

exports.GcpChannelFactory = GcpChannelFactory;
