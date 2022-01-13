export const sleep = async (milliseconds?: number) => {
  if (milliseconds) {
    await new Promise<void>(resolve => setTimeout(resolve, milliseconds))
  }
}
