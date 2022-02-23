import type * as PUPPET from 'wechaty-puppet'

export type ManagerEvents = {
  'message': (payload: PUPPET.payloads.EventMessage) => any,
  'room-join': (payload: PUPPET.payloads.EventRoomJoin) => any,
  'room-leave': (payload: PUPPET.payloads.EventRoomLeave) => any,
  'room-topic': (payload: PUPPET.payloads.EventRoomTopic) => any,
  'room-invite': (payload: PUPPET.payloads.EventRoomInvite) => any,
  'scan': (status: PUPPET.payloads.EventScan, url?: string) => any,
  'login': (userId: string) => any,
  'logout': (userId: string, message: string) =>  any,
  'friendship': (payload: PUPPET.payloads.EventFriendship) => any,
  'reset': (reason: string) => any,
  'error': (error: string) => any,
  'heartbeat': (data: string) => any,
  'ready': () => any,
  'dirty': (payload: PUPPET.payloads.EventDirty) => any
};
