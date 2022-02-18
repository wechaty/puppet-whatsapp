import type * as PUPPET from 'wechaty-puppet'

export type ManagerEvents = {
    'message': (payload: PUPPET.EventMessagePayload) => any,
    'room-join': (payload: PUPPET.EventRoomJoinPayload) => any,
    'room-leave': (payload: PUPPET.EventRoomLeavePayload) => any,
    'room-topic': (payload: PUPPET.EventRoomTopicPayload) => any,
    'room-invite': (payload: PUPPET.EventRoomInvitePayload) => any,
    'scan': (status: PUPPET.ScanStatus, url?: string) => any,
    'login': (userId: string) => any,
    'logout': (userId: string, message: string) =>  any,
    'friendship': (payload: PUPPET.EventFriendshipPayload) => any,
    'reset': (reason: string) => any,
    'error': (error: string) => any,
    'heartbeat': (data: string) => any,
    'ready': () => any,
    'dirty': (payload: PUPPET.EventDirtyPayload) => any
};
