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
import * as grpcType from '@grpc/grpc-js';
import * as util from 'util';

import {ChannelRef} from './channel_ref';
import {
  GcpChannelFactoryInterface,
  getGcpChannelFactoryClass,
} from './gcp_channel_factory';
import * as protoRoot from './generated/grpc_gcp';

import ApiConfig = protoRoot.grpc.gcp.ApiConfig;
import AffinityConfig = protoRoot.grpc.gcp.AffinityConfig;

type GrpcModule = typeof grpcType;

export = (grpc: GrpcModule) => {
  const GcpChannelFactory = getGcpChannelFactoryClass(grpc);
  /**
   * Create ApiConfig proto message from config object.
   * @param apiDefinition Api object that specifies channel pool configuation.
   * @return A protobuf message type.
   */
  function createGcpApiConfig(apiDefinition: {}): ApiConfig {
    return ApiConfig.fromObject(apiDefinition);
  }

  /**
   * Function for creating a gcp channel factory.
   * @memberof grpc-gcp
   * @param address The address of the server to connect to.
   * @param credentials Channel credentials to use when connecting
   * @param options A map of channel options that will be passed to the core.
   * @return {GcpChannelFactory} A GcpChannelFactory instance.
   */
  function gcpChannelFactoryOverride(
    address: string,
    credentials: grpcType.ChannelCredentials,
    options: {}
  ) {
    return new GcpChannelFactory(address, credentials, options);
  }

  /**
   * Pass in call properties and return a new object with modified values.
   * This function will be used together with gcpChannelFactoryOverride
   * when constructing a grpc Client.
   * @memberof grpc-gcp
   * @param callProperties Call properties with channel factory object.
   * @return Modified call properties with selected grpc channel object.
   */
  function gcpCallInvocationTransformer<RequestType, ResponseType>(
    callProperties: grpcType.CallProperties<RequestType, ResponseType>
  ): grpcType.CallProperties<RequestType, ResponseType> {
    const channelFactory = callProperties.channel;
    if (!channelFactory || !(channelFactory instanceof GcpChannelFactory)) {
      // The gcpCallInvocationTransformer needs to use gcp channel factory.
      return callProperties;
    }

    const argument = callProperties.argument;
    const metadata = callProperties.metadata;
    const call = callProperties.call;
    const methodDefinition = callProperties.methodDefinition;
    const path = methodDefinition.path;
    const callOptions = callProperties.callOptions;
    const callback = callProperties.callback;

    const preProcessResult = preProcess(channelFactory, path, argument);
    const channelRef = preProcessResult.channelRef;

    const boundKey = preProcessResult.boundKey;

    const postProcessInterceptor = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      options: any,
      nextCall: Function
    ): grpcType.InterceptingCall => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let firstMessage: any;

      const requester = {
        start: (
          metadata: grpcType.Metadata,
          listener: grpcType.Listener,
          next: Function
        ): void => {
          const newListener = {
            onReceiveMetadata: (
              metadata: grpcType.Metadata,
              next: Function
            ) => {
              next(metadata);
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onReceiveMessage: (message: any, next: Function) => {
              if (!firstMessage) firstMessage = message;
              next(message);
            },
            onReceiveStatus: (
              status: grpcType.StatusObject,
              next: Function
            ) => {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendMessage: (message: any, next: Function): void => {
          next(message);
        },
        halfClose: (next: Function): void => {
          next();
        },
        cancel: (next: Function): void => {
          next();
        },
      };
      return new grpc.InterceptingCall(nextCall(options), requester);
    };

    // Append interceptor to existing interceptors list.
    const newCallOptions = Object.assign({}, callOptions);
    const interceptors = callOptions.interceptors
      ? callOptions.interceptors
      : [];
    newCallOptions.interceptors = interceptors.concat([postProcessInterceptor]);

    return {
      argument,
      metadata,
      call,
      channel: channelRef.getChannel(),
      methodDefinition,
      callOptions: newCallOptions,
      callback,
    };
  }

  /**
   * Handle channel affinity and pick a channel before call starts.
   * @param channelFactory The channel management factory.
   * @param path Method path.
   * @param argument The request arguments object.
   * @return Result containing bound affinity key and the chosen channel ref
   * object.
   */
  function preProcess(
    channelFactory: GcpChannelFactoryInterface,
    path: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    argument?: any
  ): {boundKey: string | undefined; channelRef: ChannelRef} {
    const affinityConfig = channelFactory.getAffinityConfig(path);
    let boundKey;
    if (argument && affinityConfig) {
      const command = affinityConfig.command;
      if (
        command === AffinityConfig.Command.BOUND ||
        command === AffinityConfig.Command.UNBIND
      ) {
        boundKey = getAffinityKeyFromMessage(
          affinityConfig.affinityKey,
          argument
        );
      }
    }
    const channelRef = channelFactory.getChannelRef(boundKey);
    channelRef.activeStreamsCountIncr();
    return {
      boundKey,
      channelRef,
    };
  }

  /**
   * Handle channel affinity and streams count after call is done.
   * @param channelFactory The channel management factory.
   * @param channelRef ChannelRef instance that contains a real grpc channel.
   * @param path Method path.
   * @param boundKey Affinity key bound to a channel.
   * @param responseMsg Response proto message.
   */
  function postProcess(
    channelFactory: GcpChannelFactoryInterface,
    channelRef: ChannelRef,
    path: string,
    boundKey?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseMsg?: any
  ) {
    if (!channelFactory || !responseMsg) return;
    const affinityConfig = channelFactory.getAffinityConfig(path);
    if (affinityConfig && affinityConfig.command) {
      const command = affinityConfig.command;
      if (command === AffinityConfig.Command.BIND) {
        const affinityKey = getAffinityKeyFromMessage(
          affinityConfig.affinityKey,
          responseMsg
        );
        channelFactory.bind(channelRef, affinityKey);
      } else if (command === AffinityConfig.Command.UNBIND) {
        channelFactory.unbind(boundKey);
      }
    }
    channelRef.activeStreamsCountDecr();
  }

  /**
   * Retrieve affinity key specified in the proto message.
   * @param affinityKeyName affinity key locator.
   * @param message proto message that contains affinity info.
   * @return Affinity key string.
   */
  function getAffinityKeyFromMessage(
    affinityKeyName: string | null | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: any
  ): string {
    if (affinityKeyName) {
      let currMessage = message;
      const names = affinityKeyName.split('.');
      let i = 0;
      for (; i < names.length; i++) {
        if (currMessage[names[i]]) {
          // check if the proto message is generated by protobufjs.
          currMessage = currMessage[names[i]];
        } else {
          // otherwise use jspb format.
          const getter =
            'get' + names[i].charAt(0).toUpperCase() + names[i].substr(1);
          if (!currMessage || typeof currMessage[getter] !== 'function') break;
          currMessage = currMessage[getter]();
        }
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
  }

  return {
    createGcpApiConfig,
    gcpChannelFactoryOverride,
    gcpCallInvocationTransformer,
    GcpChannelFactory,
  };
};
