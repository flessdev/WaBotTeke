import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage, getContentType, isJidUser } from '@whiskeysockets/baileys';
import { useSQLiteAuthState, resetAuth } from './auth/sqlite-auth.js';
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
import { saveEvents, getEvents } from './eventsStore.js';

let QR
server.f.getQR = () => QR
let isActive = false;
const getIsActive =_=> isActive;

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



async function start() {
  const { version, isLatest } = await fetchLatestBaileysVersion()

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
  //const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  //const { state, saveCreds } = await useSQLiteAuthState()

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
      isActive = true;
      ownerJid = session.user.id.replace(/:\d+/, '')
      botNumber = ownerJid.slice(0, -15)
      console.log(`🔴 Connected. ID: ${ownerJid}`)
      await new Promise(resolve => setTimeout(resolve, 200));
      if (events.when_ready) await events.when_ready()
    }
    if (qr) {
      QR = qr
      server.sendQR(qr)
    }

    if (update.connection === "close") {
      isActive = false;
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
      isActive = true;
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
    let message = messages[0];
    let m = messages[0];
    //let text = messages[0]?.message?.extendedTextMessage?.text;
    const text = m.message?.conversation ||
      m.message?.extendedTextMessage?.text || "";
    console.log("text: " + text)
    //if (!text) return;

    let id = messages[0].key?.remoteJid

    if (!id || !isValidRecipient(id)) return; // ⚠️ NUEVA VALIDACIÓN

    const contentType = getContentType(m.message);
    const caption = m.message[contentType]?.caption || "";
    const mimetype = m.message[contentType]?.mimetype || ""
    const m_url = m.message[contentType]?.url || "";

    if (caption == "-geturl") {
      queueMessage(id, { text: m_url })
    }
    if (text === '-fwd') {
      const ci = m.message?.extendedTextMessage?.contextInfo;
      const q = ci?.quotedMessage;
      if (!q) return queueMessage(id, { text: '❌ Cita un mensaje válido' });

      // Desenvuelve si viene en ephemeral o viewOnce
      const unwrap = (msg) =>
        msg?.ephemeralMessage?.message ||
        msg?.viewOnceMessageV2?.message ||
        msg?.viewOnceMessage?.message ||
        msg;

      const qmsg = unwrap(q);
      /*if (!qmsg?.videoMessage) {
        return queueMessage(id, { text: '❌ Cita un video válido' });
      }*/

      const forwardable = {
        key: {
          remoteJid: m.key.remoteJid,
          id: ci.stanzaId,
          fromMe: false,
          participant: ci.participant
        },
        message: qmsg
      };

      await queueMessage(id, { forward: forwardable });
    }


    if (events?.when_get_message) await events.when_get_message(id, text);
    if (events?.when_get_message2) await events.when_get_message2(id, text);
    //console.log(m)
    //console.log("contentType: " + contentType)
    console.log(mimetype)

    if (caption == '-setevents') {
      if (contentType === 'documentMessage') {
        if (mimetype === 'text/plain' || mimetype == "application/javascript") {
          const buffer = await downloadMediaMessage(m, 'buffer', {});
          const text = buffer.toString('utf8');
          await saveEvents('default', text); // guarda en PG
          //fs.writeFileSync('./eventos.txt', buffer)
          await session.sendMessage(id, { text: 'Archivo de eventos guardado ✅' })
        } else {
          await session.sendMessage(id, { text: 'Por favor envía un archivo .txt 📄' })
        }
      } else {
        await session.sendMessage(id, { text: 'Debes adjuntar un archivo .txt junto al comando.' })
      }
    }

    
    if (text.startsWith('-url')) {
      let link = text.slice(4).trim();
      console.log('Downloading...', link, '👇');
      await session.sendMessage(id, { text: `Downloading... 👇` });

      // Extraer nombre y extensión del archivo
      const urlParts = link.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Elimina parámetros de URL si hay
      const extension = fileName.split('.').pop().toLowerCase();

      // Determinar tipo MIME básico
      let mimeType;
      if (['mp4', 'mov', 'avi'].includes(extension)) {
        mimeType = 'video/' + extension;
      } else if (['mp3', 'wav', 'ogg'].includes(extension)) {
        mimeType = 'audio/' + extension;
      } else if (['pdf'].includes(extension)) {
        mimeType = 'application/pdf';
      } else if (['doc', 'docx'].includes(extension)) {
        mimeType = 'application/msword';
      } else if (['xls', 'xlsx'].includes(extension)) {
        mimeType = 'application/vnd.ms-excel';
      } else if (['ppt', 'pptx'].includes(extension)) {
        mimeType = 'application/vnd.ms-powerpoint';
      } else if (['txt'].includes(extension)) {
        mimeType = 'text/plain';
      } else {
        mimeType = 'application/octet-stream'; // genérico
      }

      // Enviar archivo con nombre y tipo
      await session.sendMessage(id, {
        document: {
          url: link,
          mimetype: mimeType,
          fileName: fileName
        }
      });
    }

   
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
  if (isActive) {
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

const messageQueue = [];
let isSending = false;

export function queueMessage(jid, content) {
  messageQueue.push({ jid, content });
  processQueue();
}

async function processQueue() {
  setTimeout(() => {
    isSending = false;
    processQueue();
  }, 1000); // espera 1 segundo entre cada envío
  if (isSending || messageQueue.length === 0) return;
  isSending = true;

  const { jid, content } = messageQueue.shift();
  if (jid.endsWith('@s.whatsapp.net')) {
    try {
      if (!isSessionInitialized()) return;
      await session.sendMessage(jid, content);
    } catch (e) {
      console.error('❌ Error al enviar:', e);
    }
  }


}

export {
  start,
  ownerJid
}