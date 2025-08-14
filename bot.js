import makeWASocket, {DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion,downloadMediaMessage, getContentType, isJidUser} from '@whiskeysockets/baileys';
import { useSQLiteAuthState, resetAuth } from './auth/sqlite-auth.js';
import * as server from './server.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';
import * as func from './functions.js';
import Pino from 'pino';

import { existsSync } from 'fs'


let QR
server.f.getQR = () => QR

let CODE = "Code";
server.f.getCode = () => CODE;

server.setStatus(0)
const ownerId = process.env.OWNER_NUMBER + '@s.whatsapp.net';
let session = null;
let sessionPromiseResolver
let botNumber, botId

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
export function setEvents(p1){
  events = p1
}

export const MODES = ["qr", "pairingCode"]


// -- FIX META AI: envío robusto de receipts sin tocar la librería
async function safeAck(session, m) {
  try {
    const jid = m.key?.remoteJid
    const participant = m.key?.participant
    const id = m.key?.id
    if (!jid || !id) return

    // delivered/received primero, luego read
    await session.sendReceipt(jid, participant, [id], 'received')
    await session.sendReceipt(jid, participant, [id], 'read')
  } catch (e) {
    logger.warn({ err: e?.message }, 'sendReceipt falló, intento readMessages')
    try {
      await session.readMessages([m.key])
    } catch {
      // silencio
    }
  }
}

async function start() {
  const { version, isLatest } = await fetchLatestBaileysVersion()

  console.log('Versión de WhatsApp Web:', version)
  console.log('¿Es la más reciente?', isLatest)

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  //const { state, saveCreds } = await useSQLiteAuthState();
   
  session = makeWASocket.default({
    auth: state,
    printQRInTerminal: false, 
    shouldSyncHistoryMessage: ()=> false,
    ignoreOldMessages: true,
    syncFullHistory: false,
    version,//: [ 2, 3000, 1025200398 ],
    logger,
    markOnlineOnConnect: false,
    
    shouldIgnoreJid: (jid) => {
      //console.log('jid: '+ jid)
     if (typeof jid == 'undefined') return false; // si no hay jid, ignorar por seguridad
      //return jid == ownerId;
      //return jid.endsWith('@bot');
      return !jid.endsWith('@s.whatsapp.net');
    	//return true // ignora mensajes entrantes
    }
  })
  ///browser: ['Chrome', 'Chrome', '110'], // User-Agent simulado
  /*session.ws.on('CB:message', (node) => {
    console.log("Cb")
    const msgId = node?.attrs?.id || ''
    const from = node?.attrs?.from || ''
    const recipient = node?.attrs?.recipient;
    console.log("msgId: " + msgId)
    console.log("from: " + from)
    console.log("recipient: "+ node?.attrs?.recipient);
    console.log(node)
    

    //process.exit();
    if (recipient?.includes('@bot') || from?.includes('@bot')) {
      console.log('Bloqueado mensaje/recipient @bot:', recipient)
      return // no lo pasamos a Baileys
    }
    session.ev.emit('CB:message', node) // reenviamos solo lo limpio
  })*/
  
  // BLOQUEO TEMPRANO: envolver emit del WS
 /* const origEmit = session.ws.emit.bind(session.ws)
  session.ws.emit = function(event, ...args) {
    if (event === 'CB:message') {
      const node = args[0]
      const attrs = node?.attrs || {}
      const from = attrs.from || ''
      const recipient = attrs.recipient || ''
      // Corta cualquier nodo “sala/bot” ANTES del decrypt
      if (from.endsWith('@bot') || recipient.endsWith('@bot')) {
        logger.warn({ from, recipient, id: attrs.id }, 'DROP before decrypt (@bot)')
        return false // no propaga a los listeners internos
      }
    }
    return origEmit(event, ...args)
  }*/

  /*const origEmit = session.ws.emit.bind(session.ws)
  session.ws.emit = function (event, ...args) {
    if (event === 'CB:message') {
      console.log("d")
      const node = args[0]
      const attrs = node?.attrs || {}
      const from = attrs.from || ''
      const recipient = attrs.recipient || ''

      // Si es del owner en 1:1 válido, dejar pasar siempre
    
       
      

      // Si claramente es un nodo @bot → descartar
      if (from.endsWith('@bot') || recipient.endsWith('@bot')) {
        logger.warn({ from, recipient, id: attrs.id }, 'DROP before decrypt (@bot)')
        return false
      }
       return origEmit(event, ...args)
    }
    return origEmit(event, ...args)
  }*/

  // -- FIX META AI: envolver emit sin bloquear 1:1 con @bot en un extremo
  /*const origEmit = session.ws.emit.bind(session.ws)
  session.ws.emit = function (event, ...args) {
    if (event === 'CB:message') {
      const node = args[0]
      const attrs = node?.attrs || {}
      const from = attrs.from || ''
      const recipient = attrs.recipient || ''

      // Solo dropea si AMBOS extremos son @bot (evita cortar 1:1 que involucre a Meta AI)
      const fromIsBot = from.endsWith('@bot')
      const recipientIsBot = recipient.endsWith('@bot')
      if (fromIsBot && recipientIsBot) {
        logger.warn({ from, recipient, id: attrs.id }, 'DROP before decrypt (both @bot)')
        return false
      }
      // Todo lo demás fluye
      return origEmit(event, ...args)
    }
    return origEmit(event, ...args)
  }*/

  
  session.ev.on('creds.update', saveCreds)


  
  
  session.ev.on("connection.update", async update => {
    const {connection, lastDisconnect, qr } = update;

    if (update.connection == "open") {
      botId = session.user.id.replace(/:\d+/, '')
      botNumber = botId.slice(0, -15)
      console.log(`🔴Connected. ID: ${botId}`)
      
      if(events.when_ready) await events.when_ready()
      
      //sessionPromiseResolver(session)
      

    }
    if (qr) {
      QR = qr
      server.sendQR(qr)
    }
    
    if (update.connection === "close") {
      console.log("session is closed")
      const status = lastDisconnect?.error?.output?.statusCode;
      console.log(status)
      /*if (lastDisconnect?.error?.output?.statusCode === 401) {
        console.log("UNAUTHORIZED. Deleting login data...");
        await fs.rm('./auth_info_baileys', { recursive: true })   
      }
      setTimeout(start, 5000)*/

      if(status === DisconnectReason.restartRequired) {
        start()
      }
      if(status === DisconnectReason.loggedOut) {
        console.log('Connection closed. You are logged out.')
        await fs.rm('./auth_info_baileys', { recursive: true })
       start()  //Volver a pedir QRs
      }
    } 
    
    
    if (update.receivedPendingNotifications) {
      console.log('receivePendingNotifications')
      server.setStatus(1)
    }
  })




  

  console.log('MESSAGES UPSERT EVENT 👇')

  function isValidRecipient(jid) {
    return jid && jid.endsWith('@s.whatsapp.net');
  }

  function unwrapMessage(msg) {
    return msg?.ephemeralMessage?.message
        || msg?.viewOnceMessageV2?.message
        || msg?.viewOnceMessageV2Extension?.message
        || msg?.documentWithCaptionMessage?.message // por si tu cliente lo usa
        || msg
  }
  
  session.ev.on('messages.upsert', async ({type, messages }) => {
    console.log("upsert")
    if(type != 'notify') return;
    //console.log('upsert from session.env', messages[0])
    let message = messages[0];
    let m = messages[0];
    //let text = messages[0]?.message?.extendedTextMessage?.text;
    const text = m.message?.conversation
    || m.message?.extendedTextMessage?.text || "";
    console.log("text: "+text)
    //if (!text) return;

    let id = messages[0].key?.remoteJid

    if (!id || !isValidRecipient(id)) return; // ⚠️ NUEVA VALIDACIÓN
    
    const contentType = getContentType(m.message);
    const caption = m.message[contentType]?.caption || "";
    const mimetype = m.message[contentType]?.mimetype || ""
    const m_url = m.message[contentType]?.url || "";

    if(caption == "-geturl"){
      queueMessage(id, {text: m_url})
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
  if (!qmsg?.videoMessage) {
    return queueMessage(id, { text: '❌ Cita un video válido' });
  }

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

    
    if(events?.when_get_message) await events.when_get_message(id, text);
    if(events?.when_get_message2)  await events.when_get_message2(id, text);
    console.log(m)
    //console.log("contentType: " + contentType)

    if (caption == '-setevents') {
        if (contentType === 'documentMessage') {
            if (mimetype === 'text/plain' || mimetype == "application/javascript") {
                const buffer = await downloadMediaMessage(
                    m,
                    'buffer',
                    { }
                )

                
                fs.writeFileSync('./eventos.txt', buffer)
                await session.sendMessage(id, { text: 'Archivo de eventos guardado ✅' })
            } else {
                await session.sendMessage(id, { text: 'Por favor envía un archivo .txt 📄' })
            }
        } else {
            await session.sendMessage(id, { text: 'Debes adjuntar un archivo .txt junto al comando.' })
        }
    }

    const targetPath = 'tempfile.bin';
    //try {
    //  fs.unlinkSync(targetPath)
    //  console.log('Archivo eliminado correctamente');
    //} catch (error) {
    //  console.log('Error al eliminar el archivo:', error);
    //}

    if(text.startsWith('-vid ')){
      let link = text.slice(5);
                  await session.sendMessage(
                      id, 
                      { 
                          video: {
                              url: link
                          },
                          caption: 'hello word',
                        
                      }
                  )
    }

    /*if (text.startsWith('-url')) {
      let link = text.slice(4);
      console.log('Downloading', link, '👇')
      await session.sendMessage(id, { text: `downloading...` })
      await session.sendMessage(id, { document: { url: link } });
    }*/


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

    if (text.startsWith('-test')) {
      let link = text.slice(5);
      await session.sendMessage(id, { text: `downloading test...` })
      axios.get(link, { responseType: 'stream' })
        .then(response => {
          const readableStream = new Readable();
          readableStream._read = () => { }; // Dummy function, no se necesita implementar nada aquí

          response.data.on('data', chunk => {
            readableStream.push(chunk);
          });

          response.data.on('end', () => {
            readableStream.push(null); // Finalizar el flujo

            session.sendMessage(id, { document: { stream: readableStream } });
            // Aquí puedes hacer lo que necesites con la variable 'document'

            console.log('¡Descarga completada!');
          });
        })
        .catch(error => {
          console.error('Error al descargar el video:', error);
        });


    }

    
   
    if (text.startsWith('-yt')) {
      let link = text.slice(3);
      try {
        const ytstream = await ytdl(link, { 
          filter: 'videoandaudio', 
          quality: 'highestvideo' 
        });
        console.log(link + ' descargando...');
        await session.sendMessage(id, { text: `${link} descargando...` });
        session.sendMessage(id, { 
          document: { stream: ytstream }, 
          mimetype: 'video/mp4' 
        });
      } catch (error) {
        console.error('Error al descargar video de YT:', error);
        await session.sendMessage(id, { text: `Error al descargar video de YT` });
      }
    }
    
    if(text.startsWith('-360')){
      let link = text.slice(4)
      let ytstream = ytdl(link, {
        filter: 'videoandaudio'
      })
      await session.sendMessage(id, { text: `downloading 360...` })
      session.sendMessage(id, { document: { stream: ytstream }, mimetype: 'video/mp4' });
        
    }

    if (text.startsWith('-ab')) {
      let link = text.slice(3);
      console.log('downloading ', link);
      func.sendByChunks(id, link, 1, 4)
    }



  })

}

 const isSessionInitialized = () => !!(session?.authState?.creds);

export async function requestPairingCode(numberx){
  if(!isSessionInitialized()) {
    console.error('Sesión no inicializada correctamente');
    return;
  }
 
  if (!session?.authState?.creds?.registered) {
    const number = numberx
    try{
      const code = await session.requestPairingCode(number);
      CODE = code;

      return code;
    }catch(e){
      return "Error al solitar código " + e.stack
    }
    
    //console.clear();
    //console.log(code)
    //server.sendCode(code)
  }
}

export async function sendMessage(...args){
  if(!isSessionInitialized) {
    console.error('Sesión no inicializada correctamente');
    return;
  }else{
    session?.sendMessage(...args);
  }
  
}

const messageQueue = [];
let isSending = false;

export function queueMessage(jid, content) {
  messageQueue.push({ jid, content });
  processQueue();
}

async function processQueue() {
  if (isSending || messageQueue.length === 0) return;
  isSending = true;

  const { jid, content } = messageQueue.shift();
  if (jid.endsWith('@s.whatsapp.net')) {
    try {
      if(!isSessionInitialized()) return;
      await session.sendMessage(jid, content);
    } catch (e) {
      console.error('❌ Error al enviar:', e);
    }
  }

  setTimeout(() => {
    isSending = false;
    processQueue();
  }, 1000); // espera 1 segundo entre cada envío
}

function isLoggedIn() {
  const authPath = path.join(__dirname, 'auth', 'creds.json');
  return fs.existsSync(authPath);
}


//module.exports = { start, ownerId }
export {
  start,
  ownerId,
  isLoggedIn
}
