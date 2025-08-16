"use strict";

// --- PostgreSQL ---
import pgPkg from 'pg';
const { Pool } = pgPkg;

// --- Baileys core ---
import waprotoPkg from '@whiskeysockets/baileys/WAProto/index.js';
const {proto} = waprotoPkg;
import { Curve, signedKeyPair } from '@whiskeysockets/baileys/lib/Utils/crypto.js';
import { generateRegistrationId } from '@whiskeysockets/baileys/lib/Utils/generics.js';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import baileysPkg from '@whiskeysockets/baileys';
const { AuthenticationCreds } = baileysPkg;

// Utilidades buffer <-> JSON
function bufferToJSON(obj) {
  if (Buffer.isBuffer(obj)) return { type: 'Buffer', data: Array.from(obj) };
  if (Array.isArray(obj)) return obj.map(bufferToJSON);
  if (obj && typeof obj === 'object') {
    if (typeof obj.toJSON === 'function') return obj.toJSON();
    const res = {};
    for (const k in obj) if (Object.hasOwn(obj, k)) res[k] = bufferToJSON(obj[k]);
    return res;
  }
  return obj;
}
function jsonToBuffer(obj) {
  if (obj?.type === 'Buffer' && Array.isArray(obj.data)) return Buffer.from(obj.data);
  if (Array.isArray(obj)) return obj.map(jsonToBuffer);
  if (obj && typeof obj === 'object') {
    const res = {};
    for (const k in obj) if (Object.hasOwn(obj, k)) res[k] = jsonToBuffer(obj[k]);
    return res;
  }
  return obj;
}

// initAuthCreds adaptado a ESM
export const initAuthCreds = () => {
  const identityKey = Curve.generateKeyPair();
  return {
    noiseKey: Curve.generateKeyPair(),
    signedIdentityKey: identityKey,
    signedPreKey: signedKeyPair(identityKey, 1),
    registrationId: generateRegistrationId(),
    advSecretKey: randomBytes(32).toString('base64'),
    processedHistoryMessages: [],
    nextPreKeyId: 1,
    firstUnuploadedPreKeyId: 1,
    accountSyncCounter: 0,
    accountSettings: { unarchiveChats: false },
    deviceId: randomBytes(16).toString('base64'),
    phoneId: uuidv4(),
    identityId: randomBytes(20),
    registered: false,
    backupToken: randomBytes(20),
    registration: {},
    pairingEphemeralKeyPair: Curve.generateKeyPair(),
    pairingCode: undefined,
    lastPropHash: undefined,
    routingInfo: undefined
  };
};

// Clase PostgreSQLAuthState adaptada
class PostgreSQLAuthState {
  constructor(poolOrConfig, sessionId) {
    this.pool = poolOrConfig instanceof Pool ? poolOrConfig : new Pool(poolOrConfig);
    this.sessionId = sessionId;
    this.ensureTableExists();
  }
  async ensureTableExists() {
    await this.executeQuery(`
      CREATE TABLE IF NOT EXISTS auth_data (
        session_key VARCHAR(255) PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);
  }
  getKey(k) { return `${this.sessionId}:${k}`; }
  async executeQuery(q, params = []) {
    const client = await this.pool.connect();
    try {
      const res = await client.query(q, params);
      return res.rows;
    } finally {
      client.release();
    }
  }
  async writeData(key, data) {
    const serialized = JSON.stringify(bufferToJSON(data));
    await this.executeQuery(
      `INSERT INTO auth_data (session_key, data)
       VALUES ($1, $2)
       ON CONFLICT (session_key) DO UPDATE SET data = EXCLUDED.data`,
      [this.getKey(key), serialized]
    );
  }
  async readData(key) {
    const rows = await this.executeQuery(
      'SELECT data FROM auth_data WHERE session_key = $1',
      [this.getKey(key)]
    );
    return rows.length ? jsonToBuffer(JSON.parse(rows[0].data)) : null;
  }
  async removeData(key) {
    await this.executeQuery(
      'DELETE FROM auth_data WHERE session_key = $1',
      [this.getKey(key)]
    );
  }
  async getAuthState() {
    const creds = (await this.readData('auth_creds')) || initAuthCreds();
    return {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(ids.map(async id => {
            const value = await this.readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              data[id] = proto.Message.AppStateSyncKeyData.fromObject(value);
            } else {
              data[id] = value;
            }
          }));
          return data;
        },
        set: async data => {
          const tasks = Object.entries(data).flatMap(([cat, catData]) =>
            Object.entries(catData || {}).map(([id, val]) => {
              const key = `${cat}-${id}`;
              return val ? this.writeData(key, val) : this.removeData(key);
            })
          );
          await Promise.all(tasks);
        }
      }
    };
  }
  async saveCreds(creds) { await this.writeData('auth_creds', creds); }
  async deleteSession() {
    await this.executeQuery(
      'DELETE FROM auth_data WHERE session_key LIKE $1',
      [`${this.sessionId}:%`]
    );
  }
}

// Wrapper de uso
export async function usePostgreSQLAuthState(poolOrConfig, sessionId) {
  const authState = new PostgreSQLAuthState(poolOrConfig, sessionId);
  const state = await authState.getAuthState();
  return {
    state,
    saveCreds: async () => { await authState.saveCreds(state.creds); },
    deleteSession: async () => { await authState.deleteSession(); }
  };
}
