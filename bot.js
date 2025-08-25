import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage, getContentType, isJidUser } from '@whiskeysockets/baileys';
import * as server from './server.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';
import * as func from './functions.js';
import Pino from 'pino';
import { usePostgreSQLAuthState } from "./postgres-baileys.js";
import { existsSync } from 'fs'
import { Pool } from 'pg';
import * as eventsStore from './eventsStore.js';
import { setIsActive, getIsActive, setOwnerJid, getOwnerJid } from './botState.js';
import { injectSender, queueMessage } from './messageQueue.js';
import { setQR, clearQR } from './qrState.js';
import { runEventsFromWA } from './eventsAdapter.js';

let session = null;
let sessionPromiseResolver
let botNumber, ownerJid;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = Pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
})

let events = {}
export function setEvents(p1) {
  events = p1
}


process.on('unhandledRejection', async error => {
  console.error('UnhandledRejection: ', error);
  if (getIsActive()) {
    await sendMessage(getOwnerJid(), { text: 'UnhandledRejection: ' + error.stack })
  }
  process.exit(1)
});
process.on('uncaughtException', async error => {
  console.error("UncaughtException: ", error);
  if (getIsActive()) {
    await sendMessage(getOwnerJid(), { text: 'UnhandledRejection: ' + error.stack })
  }
  process.exit(1)
});


async function start() {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  injectSender(async (jid, content) => {
    try{
      await session.sendMessage(jid, content)
    } catch (e) {
      console.error(e);// Tab to edit
    }
  });

  console.log('Versión de WhatsApp Web:', version)
  console.log('¿Es la más reciente?', isLatest)

  const pool = new Pool({
    /*host: process.env.POSTGRES_HOST,
    port: 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,*/
    connectionString: process.env.PG_DATABASE_URL,
    ssl: true
  });

  const sessionId = '1234';
  const { state, saveCreds, deleteSession } = await usePostgreSQLAuthState(pool, sessionId);

  session = makeWASocket.default({
    auth: state,
    printQRInTerminal: false,
    shouldSyncHistoryMessage: () => false,
    ignoreOldMessages: true,
    syncFullHistory: false,
    version, //: [ 2, 3000, 1025200398 ],
    logger,
    markOnlineOnConnect: false,

    shouldIgnoreJid: (jid) => {
      //console.log('jid: '+ jid)
      if (typeof jid == 'undefined') return false; // si no hay jid, ignorar por seguridad
      //return jid.endsWith('@bot');
      return !jid.endsWith('@s.whatsapp.net');
      //return true // ignora mensajes entrantes
    }
  })
  session.ev.on('creds.update', saveCreds)




  session.ev.on("connection.update", async update => {
    const { connection, lastDisconnect, qr } = update;

    if (update.connection == "open") {
      setIsActive(true);
      const cleanOwner = session.user.id.replace(/:\d+/, '');
      setOwnerJid(cleanOwner);
      botNumber = cleanOwner.slice(0, -15);
      console.log(`🔴 Connected. ID: ${ownerJid}`)
      if (events.when_ready) await events.when_ready()
    }
    if (qr) {
      setQR(qr);
    }

    if (update.connection === "close") {
      setIsActive(false);
      clearQR();
      console.log("session is closed")
      const status = lastDisconnect?.error?.output?.statusCode;
      console.log(status)
      /*if (lastDisconnect?.error?.output?.statusCode === 401) {
        console.log("UNAUTHORIZED. Deleting login data...");
        await fs.rm('./auth_info_baileys', { recursive: true })   
      }
      setTimeout(start, 5000)*/

      if (status === DisconnectReason.restartRequired) {
        start()
      }
      if (status === DisconnectReason.loggedOut) {
        console.log('Connection closed. You are logged out.')
        //await fs.rm('./auth_info_baileys', { recursive: true })
        deleteSession()
        start() //Volver a pedir QRs
      }
    }


    if (update.receivedPendingNotifications) {
      console.log('receivePendingNotifications')
    }
  })

  console.log('MESSAGES UPSERT EVENT 👇')

  function isValidRecipient(jid) {
    return jid && jid.endsWith('@s.whatsapp.net');
  }

  function unwrapMessage(msg) {
    return msg?.ephemeralMessage?.message ||
      msg?.viewOnceMessageV2?.message ||
      msg?.viewOnceMessageV2Extension?.message ||
      msg?.documentWithCaptionMessage?.message // por si tu cliente lo usa
      ||
      msg
  }

  session.ev.on('messages.upsert', async ({ type, messages }) => {
    console.log("upsert")
    if (type != 'notify') return;
    //console.log('upsert from session.env', messages[0])

    let m = messages[0];
    let id = m.key?.remoteJid
    if (!id || !isValidRecipient(id)) return; // ⚠️ NUEVA VALIDACIÓN
    //if (events?.when_get_message) await events.when_get_message({messages});

    await runEventsFromWA({
      messages: messages
    });
    
  })

}

const isSessionInitialized = () => !!(session?.authState?.creds);

export async function requestPairingCode(number) {
  if (!isSessionInitialized()) {
    console.error('Sesión no inicializada correctamente');
    return;
  }

  if (!session?.authState?.creds?.registered) {
    try {
      return await session.requestPairingCode(number);
    } catch (e) {
      return "Error al solitar código " + e.stack
    }
  }
}

export async function sendMessage(...args) {
  if (!getIsActive()) {
    console.error('Bot aún no activo para enviar mensajes');
    return;
  } else {
    try{
      return await session?.sendMessage(...args);
    }catch(e){
      return console.log('Error al enviar mensaje: '+ e)
    }
  }

}

export {
  start,
  queueMessage
}