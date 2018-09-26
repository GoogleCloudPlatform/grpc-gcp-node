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

/**
 * A wrapper of real grpc channel. Also provides helper functions to
 * calculate affinity counts and active streams count.
 */
class ChannelRef {
  /**
   * @param {grpc.Channel} channel The underlying grpc channel.
   * @param {number} channelId Id for creating unique channel.
   * @param {number=} affinityCount Initial affinity count.
   * @param {number=} activeStreamsCount Initial streams count.
   */
  constructor(channel, channelId, affinityCount, activeStreamsCount) {
    this._channel = channel;
    this._channelId = channelId;
    this._affinityCount = affinityCount ? affinityCount : 0;
    this._activeStreamsCount = activeStreamsCount ? activeStreamsCount : 0;
  }

  affinityCountIncr() {
    this._affinityCount++;
  }

  activeStreamsCountIncr() {
    this._activeStreamsCount++;
  }

  affinityCountDecr() {
    this._affinityCount--;
  }

  activeStreamsCountDecr() {
    this._activeStreamsCount--;
  }

  getAffinityCount() {
    return this._affinityCount;
  }

  getActiveStreamsCount() {
    return this._activeStreamsCount;
  }

  getChannel() {
    return this._channel;
  }
}

module.exports = ChannelRef;
