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

import * as grpc from '@grpc/grpc-js';

/**
 * A wrapper of real grpc channel. Also provides helper functions to
 * calculate affinity counts and active streams count.
 */
export class ChannelRef {
  private readonly channel: grpc.ChannelInterface;
  private readonly channelId: number;
  private affinityCount: number;
  private activeStreamsCount: number;
  private debugHeadersRequestedAt: Date | null;
  private shouldForceDebugHeadersOnNextRequest: boolean;
  private closed: boolean;

  /**
   * @param channel The underlying grpc channel.
   * @param channelId Id for creating unique channel.
   * @param affinityCount Initial affinity count.
   * @param activeStreamsCount Initial streams count.
   */
  constructor(
    channel: grpc.ChannelInterface,
    channelId: number,
    affinityCount?: number,
    activeStreamsCount?: number
  ) {
    this.channel = channel;
    this.channelId = channelId;
    this.affinityCount = affinityCount ? affinityCount : 0;
    this.activeStreamsCount = activeStreamsCount ? activeStreamsCount : 0;
    this.debugHeadersRequestedAt = null;
    this.shouldForceDebugHeadersOnNextRequest = false;
    this.closed = false;
  }

  close() {
    this.closed = true;
    this.channel.close();
  }

  isClosed() {
    return this.closed;
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

  forceDebugHeadersOnNextRequest() {
    this.shouldForceDebugHeadersOnNextRequest = true;
  }
  notifyDebugHeadersRequested() {
    this.debugHeadersRequestedAt = new Date();
    this.shouldForceDebugHeadersOnNextRequest = false;
  }

  getDebugHeadersRequestedAt(): Date | null {
    return this.debugHeadersRequestedAt;
  }

  getChannel() {
    return this.channel;
  }
}
