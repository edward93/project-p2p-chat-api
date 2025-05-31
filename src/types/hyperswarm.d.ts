// src/types/hyperswarm.d.ts
declare module 'hyperswarm' {
  import { EventEmitter } from 'events'
  import { Socket } from 'net'

  interface HyperswarmOptions {
    // You can add more options from the real API if needed
  }

  interface JoinOptions {
    lookup?: boolean
    announce?: boolean
  }

  interface PeerInfo {
    publicKey: Buffer
    // Add more if needed
  }

  class Hyperswarm extends EventEmitter {
    constructor(options?: HyperswarmOptions)
    join(topic: Buffer, opts?: JoinOptions): void
    leave(topic: Buffer): void
    destroy(cb?: () => void): void
    on(event: 'connection', listener: (socket: Socket, details: PeerInfo) => void): this
    on(event: string, listener: (...args: any[]) => void): this
  }

  export default Hyperswarm
}