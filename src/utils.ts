export const sleep = async (milliseconds?: number) => {
  if (milliseconds) {
    await new Promise<void>(resolve => setTimeout(resolve, milliseconds))
  }
}

export const isRoomId = (id: string) => {
  return /@g.us$/i.test(id)
}

export const isContactId = (id: string) => {
  return /@c.us$/i.test(id)
}
