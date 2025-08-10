import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

import { initAuthCreds } from '@whiskeysockets/baileys'
//import { proto } from '@whiskeysockets/baileys/WAProto/index.js'
import pkg from '@whiskeysockets/baileys/WAProto/index.js'
const { proto } = pkg

import { BufferJSON } from '@whiskeysockets/baileys/lib/Utils/generics.js'

const dbPromise = open({
  filename: './auth.db',
  driver: sqlite3.Database
})

export const useSQLiteAuthState = async () => {
  const db = await dbPromise

  await db.exec(`
    CREATE TABLE IF NOT EXISTS creds (
      id TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS keys (
      category TEXT,
      id TEXT,
      value TEXT,
      PRIMARY KEY (category, id)
    );
  `)

  const loadCreds = async () => {
    const row = await db.get('SELECT value FROM creds WHERE id = ?', 'creds')
    return row ? JSON.parse(row.value, BufferJSON.reviver) : initAuthCreds()
  }

  const saveCreds = async (creds) => {
    const value = JSON.stringify(creds, BufferJSON.replacer)
    await db.run('INSERT OR REPLACE INTO creds (id, value) VALUES (?, ?)', 'creds', value)
  }

  const getKeys = async (type, ids) => {
    const data = {}

    for (const id of ids) {
      const row = await db.get('SELECT value FROM keys WHERE category = ? AND id = ?', type, id)
      if (row) {
        let value = JSON.parse(row.value, BufferJSON.reviver)
        if (type === 'app-state-sync-key') {
          value = proto.Message.AppStateSyncKeyData.fromObject(value)
        }
        data[id] = value
      }
    }

    return data
  }

  const setKeys = async (data) => {
    const insert = await db.prepare('INSERT OR REPLACE INTO keys (category, id, value) VALUES (?, ?, ?)')
    const remove = await db.prepare('DELETE FROM keys WHERE category = ? AND id = ?')

    await db.exec('BEGIN TRANSACTION')
    for (const category in data) {
      for (const id in data[category]) {
        const value = data[category][id]
        if (value) {
          const serialized = JSON.stringify(value, BufferJSON.replacer)
          await insert.run(category, id, serialized)
        } else {
          await remove.run(category, id)
        }
      }
    }
    await db.exec('COMMIT')
  }

  const creds = await loadCreds()

  return {
    state: {
      creds,
      keys: {
        get: getKeys,
        set: setKeys
      }
    },
    saveCreds: async () => saveCreds(creds)
  }
}

export const resetAuth = async () => {
  const db = await dbPromise
  await db.run('DELETE FROM creds')
  await db.run('DELETE FROM keys')
}