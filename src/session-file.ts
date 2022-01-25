import { readFile, writeFile } from 'fs'

const SESSION_FILE_PATH = './session.json'

export const getSession = async (): Promise<null> => {
  return new Promise<any>((resolve, reject) => {
    readFile(SESSION_FILE_PATH, 'utf-8', (err, data) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (err) {
        reject(err)
      }
      resolve(JSON.parse(data))
    })
  })
}

export const saveSession = async (session: any): Promise<null> => {
  return new Promise<any>((resolve, reject) => {
    writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
      if (err) {
        reject(err)
      } else {
        resolve(null)
      }
    })
  })
}
