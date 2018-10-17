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

import * as grpc from 'grpc';
import * as _ from 'lodash';
import * as protobuf from 'protobufjs';
import * as util from 'util';

import {GcpChannelFactory} from './gcp_channel_factory';
import { ChannelRef } from './channel_ref';

const PROTO_PATH = __dirname + '/protos/grpc_gcp.proto';

var protoRoot = protobuf.loadSync(PROTO_PATH);
const ApiConfig: any = protoRoot.lookupType('grpc.gcp.ApiConfig');
const AffinityConfig: any = protoRoot.lookupType('grpc.gcp.AffinityConfig');

/**
 * Create ApiConfig proto message from config object.
 * @param apiDefinition Api object that specifies channel pool configuation.
 * @return A protobuf message type.
 */
export function createGcpApiConfig(apiDefinition: {}) : protobuf.Message {
  var apiConfigMsg = ApiConfig.fromObject(apiDefinition);
  return apiConfigMsg;
};

/**
 * Function for creating a gcp channel factory.
 * @memberof grpc-gcp
 * @param address The address of the server to connect to.
 * @param credentials Channel credentials to use when connecting
 * @param options A map of channel options that will be passed to the core.
 * @return {GcpChannelFactory} A GcpChannelFactory instance.
 */
export function gcpChannelFactoryOverride(
  address: string,
  credentials: grpc.ChannelCredentials,
  options: {}
) {
  return new GcpChannelFactory(address, credentials, options);
};

export interface MethodDefinition {
  path: string;
  requestStream: boolean;
  responseStream: boolean;
  requestSerialize: grpc.serialize<any>;
  responseDeserialize: grpc.deserialize<any>;
}

export interface InputCallProperties {
  argument?: any;
  metadata: grpc.Metadata;
  call: grpc.ClientUnaryCall | grpc.ClientReadableStream<any> | grpc.ClientDuplexStream<any, any> | grpc.ClientWritableStream<any>;
  channel: GcpChannelFactory;
  methodDefinition: MethodDefinition;
  callOptions: grpc.CallOptions;
  callback?: Function;
}

export interface OutputCallProperties {
  argument?: any;
  metadata: grpc.Metadata;
  call: grpc.ClientUnaryCall | grpc.ClientReadableStream<any> | grpc.ClientDuplexStream<any, any> | grpc.ClientWritableStream<any>;
  channel: grpc.Channel;
  methodDefinition: MethodDefinition;
  callOptions: grpc.CallOptions;
  callback?: Function;
}

/**
 * Pass in call properties and return a new object with modified values.
 * This function will be used together with gcpChannelFactoryOverride
 * when constructing a grpc Client.
 * @memberof grpc-gcp
 * @param callProperties Call properties with channel factory object.
 * @return Modified call properties with selected grpc channel object.
 */
export function gcpCallInvocationTransformer(callProperties: InputCallProperties): OutputCallProperties {
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

  var postProcessInterceptor = function(options: any, nextCall: Function): grpc.InterceptingCall {
    var firstMessage: any;

    var requester = {
      start: function(metadata: grpc.Metadata, listener: grpc.Listener, next: Function): void {
        var newListener = {
          onReceiveMetadata: function(metadata: grpc.Metadata, next: Function) {
            next(metadata);
          },
          onReceiveMessage: function(message: any, next: Function) {
            if (!firstMessage) firstMessage = message;
            next(message);
          },
          onReceiveStatus: function(status: grpc.StatusObject, next: Function) {
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
      sendMessage: function(message: any, next: Function): void {
        next(message);
      },
      halfClose: function(next: Function): void {
        next();
      },
      cancel: function(next: Function): void {
        next();
      },
    };
    return new grpc.InterceptingCall(nextCall(options), requester);
  };

  // Append interceptor to existing interceptors list.
  var newCallOptions = _.assign({}, callOptions);
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
 * @param channelFactory The channel management factory.
 * @param path Method path.
 * @param argument The request arguments object.
 * @return Result containing bound affinity key and the chosen channel ref object.
 */
function preProcess(channelFactory: GcpChannelFactory, path: string, argument?: any): {boundKey: string|undefined; channelRef: ChannelRef} {
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
 * @param channelFactory The channel management factory.
 * @param channelRef ChannelRef instance that contains a real grpc channel.
 * @param path Method path.
 * @param boundKey Affinity key bound to a channel.
 * @param responseMsg Response proto message.
 */
function postProcess (
  channelFactory: GcpChannelFactory,
  channelRef: ChannelRef,
  path: string,
  boundKey?: string,
  responseMsg?: any
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
 * @param affinityKeyName affinity key locator.
 * @param message proto message that contains affinity info.
 * @return Affinity key string.
 */
function getAffinityKeyFromMessage(affinityKeyName: string, message: any): string {
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

export {GcpChannelFactory};
