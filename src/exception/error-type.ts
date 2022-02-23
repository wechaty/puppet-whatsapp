enum BASE_ERROR_TYPE {
  ERR_REQUEST_TIMEOUT = 1101,  // 请求超时
  ERR_START = 1102,  // 启动异常
  ERR_STOP = 1103,  // 停止异常
}

enum INIT_ERROR_TYPE {
  ERR_INIT = 1001,  // 未初始化
  ERR_NOT_LOGIN = 1002,  // 未登录
  ERR_CACHE_EXISTED = 1003,  // 缓存已存在
  ERR_NO_CACHE = 1004,  // 缓存无效
}

enum MESSAGE_ERROR_TYPE {
  ERR_SEND_MSG = 2001,  // 发送消息失败
  ERR_SEND_MSG_TIMEOUT = 2002,  // 发送消息超时
  ERR_UNKNOWN_SEND_STATUS = 2003,  // 未知消息发送结果
  ERR_MSG_NOT_FOUND = 2004,  // 未查到消息内容
  ERR_MSG_NOT_MATCH = 2005,  // 消息类型不匹配
  ERR_MSG_CONTACT = 2006,  // 提取卡片消息异常
  ERR_MSG_IMAGE = 2007,  // 提取图片消息异常
  ERR_MSG_FILE = 2008,  // 提取文件消息异常
  ERR_MSG_URL_LINK = 2009,  // 提取链接消息异常
  ERR_MSG_FORWARD = 2010,  // 转发消息异常
  ERR_MSG_IMAGE_WITHOUT_BODY = 2011,  // 图片消息中不包含缩率图信息
}

enum ROOM_ERROR_TYPE {
  ERR_ROOM_NOT_FOUND = 3001,  // 群聊不存在
  ERR_CREATE_ROOM = 3002,  // 创建群聊失败
  ERR_MODIFY_ROOM_NAME = 3003,  // 修改群名称失败
  ERR_ADD_ROOM = 3004,  // 拉人进群失败
  ERR_REMOVE_ROOM = 3005,  // 踢人出群失败
  ERR_ACCEPT_ROOM_INVITATION = 3006, // 自动通过群邀请失败
  ERR_ANNOUNCE_NO_PERMISSION = 3007,  // 无发送群公告权限
  ERR_ROOM_AVATAR_NOT_FOUND = 3008,  // 群头像不存在
}

enum CONTACT_ERROR_TYPE {
  ERR_CONTACT_NOT_FOUND = 4001,  // 联系人不存在
  ERR_INVALID_CONTACT_ID = 4002,  // 联系人ID无效
  ERR_CONTACT_CARD_ID = 4003,  // 名片id异常
}

enum OTHER_ERROR_TYPE {
  ERR_RATE_FUNCTION_NOT_FOUND = 5001, // 队列中对象不存在
  ERR_GROUP_OR_CONTACT_ID = 5002, // ID错误
}

export const WA_ERROR_TYPE = {
  ...BASE_ERROR_TYPE,  // 基础错误类型
  ...INIT_ERROR_TYPE,  // 初始化错误类型
  ...MESSAGE_ERROR_TYPE,  // 消息相关错误类型
  ...ROOM_ERROR_TYPE,  // 群相关错误类型
  ...CONTACT_ERROR_TYPE,  // 联系人相关错误类型
  ...OTHER_ERROR_TYPE, // 其他错误类型
}

export type WAErrorType = BASE_ERROR_TYPE | INIT_ERROR_TYPE | MESSAGE_ERROR_TYPE | ROOM_ERROR_TYPE | CONTACT_ERROR_TYPE | OTHER_ERROR_TYPE
