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

import {Channel} from 'grpc';

/**
 * A wrapper of real grpc channel. Also provides helper functions to
 * calculate affinity counts and active streams count.
 */
export class ChannelRef {
  private readonly channel: Channel;
  private readonly channelId: number;
  private affinityCount: number;
  private activeStreamsCount: number;

  /**
   * @param {grpc.Channel} channel The underlying grpc channel.
   * @param {number} channelId Id for creating unique channel.
   * @param {number=} affinityCount Initial affinity count.
   * @param {number=} activeStreamsCount Initial streams count.
   */
  constructor(channel: Channel, channelId: number, affinityCount?: number, activeStreamsCount?: number) {
    this.channel = channel;
    this.channelId = channelId;
    this.affinityCount = affinityCount ? affinityCount : 0;
    this.activeStreamsCount = activeStreamsCount ? activeStreamsCount : 0;
  }

  affinityCountIncr() {
    this.affinityCount++;
  }

  activeStreamsCountIncr() {
    this.activeStreamsCount++;
  }

  affinityCountDecr() {
    this.affinityCount--;
  }

  activeStreamsCountDecr() {
    this.activeStreamsCount--;
  }

  getAffinityCount() {
    return this.affinityCount;
  }

  getActiveStreamsCount() {
    return this.activeStreamsCount;
  }

  getChannel() {
    return this.channel;
  }
}
