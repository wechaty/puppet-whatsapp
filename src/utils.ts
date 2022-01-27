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

export const batchProcess = async (batchSize: number, list: any[], func: any) => {
  let index = 0
  while (batchSize * index < list.length) {
    const curList = list.slice(batchSize * index, batchSize * (index + 1))
    await Promise.all(curList.map(func))
    index++
  }
}
