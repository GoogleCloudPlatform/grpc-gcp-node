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

'use district';

const grpc = require('grpc');
const GcpChannelFactory = require('./gcp_channel_factory');
const ApiConfig = require('./generated/grpc_gcp_pb');

class GcpCallInvoker {
  constructor(gcpApiConfig) {
    this._gcpApiConfig = gcpApiConfig;
    console.log('***GcpApiConfig:');
    console.log(this._gcpApiConfig);
  }

  createChannel(address, credentials, options) {
    options.gcpApiConfig = this._gcpApiConfig;
    this._channelFactory = new GcpChannelFactory(address, credentials, options);
  }

  getChannel() {
    return this._channelFactory;
  }

  makeUnaryRequest(methodDefinition, argument, metadata, options, interceptors, emitter, callback) {}

  makeClientStreamRequest(method_definition, metadata, options, interceptors, emitter, callback) {}

  makeServerStreamRequest(method_definition, argument, metadata, options, interceptors, emitter) {}

  makeBidiStreamRequest(method_definition, metadata, options, interceptors, emitter) {}
}

module.exports = GcpCallInvoker;
