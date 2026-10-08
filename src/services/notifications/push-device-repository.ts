export interface PushDeviceRepository { register(token:string):Promise<void>; unregister(token:string):Promise<void>; }
