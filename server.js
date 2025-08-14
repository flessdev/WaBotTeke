import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';

import qrcode from 'qrcode';
import * as bot from './bot.js';
import * as func from './functions.js';
import os from 'os';

const PORT = process.env.PORT || 80;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let fullDomainName = process.env.FULL_DOMAIN_NAME || ""; 
let isKeepAlive = false;
export const setFullDomainName = v => fullDomainName = v;

export async function ping(){
 if(!fullDomainName) return;
  try{
  const url = `https://${fullDomainName}/ping`;
  const res = await fetch(url);
  const data = await res.text();
  return data;
  }catch(e){
   return e.stack;
  }
}
export function startAutoPing(){
 setInterval(async () => {
  const res = await ping();
  console.log(res);
 }, 300_000); // 1 min
}
if(fullDomainName) startAutoPing();


const ownerPass = process.env.OWNER_PASSWORD.trim()
if (!ownerPass) {
  console.log('Please add a variable in Tools>Secrets with key: OWNER_PASSWORD, containing the password for the owner')
  process.exit()
}
const statusText = [
  'INACTIVE Owner has not logged in to Whatsapp.',
  'ACTIVE Bot is ready to respond on Whatsapp.'
]
let status = 0

export const getStatus = _=> status;
const createHtml = ({title="x", body=""} = {}) => {
  return `<html>
    <head>
    	<style>*{color: black}</style>
      <title>${title} </title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>${body}</body>
  </html>`
}

let defaultLandingPage = createHtml({
  body: `<h3 class="info">SERVER BOT WA-REPLIT</h3>
<p><b>Status Bot: </b><span id="status">${statusText[status]}</span></p>

<form>
<label for="phone">phone number:</label>
+<input type="text" id="phone" />
<button id="send-btn">Send</button>
</form>

<div id="msg" style="font-size:30px">CODE</div>
<br/>
<img id="qr" alt="QR CODE" width="300" height="300">

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io()
socket.emit("pageLoaded")

const status = document.getElementById("status")
const btn = document.getElementById('send-btn')
const msg = document.getElementById('msg')

btn.onclick = () => {
  const phone = document.getElementById('phone').value.trim()
  socket.emit('request-code', phone)
  btn.disabled = true
  btn.textContent = 'Procesando...'
}

socket.on("set status", function(newStatus) {
  status.textContent = newStatus
})
socket.on("alert", function(msg) {
  alert(msg)
})
socket.on("qr", function(qr) {
  document.getElementById("qr").src = qr
})

socket.on("remove qr")

socket.on('code', (code) => {
  msg.textContent = 'Código recibido: '+ code
})

socket.on('tick', (seconds) => {
  const btn = document.getElementById('send-btn')
  if (seconds > 0) {
    btn.disabled = true
    btn.textContent = 'Wait ' + seconds+ 's'
  } else {
    btn.disabled = false
    btn.textContent = 'Send'
  }
})

socket.on('error', (err) => {
  msg.textContent = err
  btn.disabled = false
  btn.textContent = 'Send'
})
</script>`})

const setLandingPage = newPage => { defaultLandingPage = newPage }

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});
const COOLDOWN_MS = 60000
const perNumberState = new Map() // phone -> { last: number, pending: boolean }

io.on('connection', socket => {
  console.log('client connected', socket.id)
  if (status === 1) return socket.emit('alert', 'The bot is already active.')
  
  socket.on('pageLoaded', () => {
    if (!f.getQR) return
    const qr = f.getQR()
    if (!qr) return
    sendQR(qr)
  })

  socket.on('request-code', async (phone) => {
    const now = Date.now()
    const state = perNumberState.get(phone) || { last: 0, pending: false }
    const remaining = COOLDOWN_MS - (now - state.last)

    if (remaining > 0) {
      // Ya en cooldown: envía tick actualizado
      let timeLeft = Math.ceil(remaining / 1000)
      const interval = setInterval(() => {
        socket.emit('tick', timeLeft--)
        if (timeLeft < 0) clearInterval(interval)
      }, 1000)
      return
    }

    state.pending = true
    perNumberState.set(phone, state)

    try {
      socket.emit("alert", phone)
      console.log(phone)
      const code = await bot.requestPairingCode(phone);
      console.log(
        code)
      state.last = Date.now()
      socket.emit('code', code)

      // Arranca countdown desde el servidor
      let timeLeft = COOLDOWN_MS / 1000
      const interval = setInterval(() => {
        socket.emit('tick', timeLeft--)
        if (timeLeft < 0) clearInterval(interval)
      }, 1000)
    } catch (err) {
      socket.emit('error', 'No se pudo generar el código' + err.stack)
    } finally {
      state.pending = false
      perNumberState.set(phone, state)
    }
  })
  
  
  socket.on('login', pass => {
    console.log('login')
    if (!pass) return
    console.log('pass exists!')
    if (pass === ownerPass) {
      socket.emit('alert',  'CORRECT PASSWORD')
      console.log('pass == ownerPass')
      

      sendCode(f.getCode())
      
      
      
    } else {
      socket.emit('alert', 'Incorrect password.')
    }
  })
  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id)
    console.log('loggedInSocket === socket.id', loggedInSocket === socket.id, 'loggedInSocket ahora es null')
    if (loggedInSocket === socket.id) loggedInSocket = null
  })
})

let botEvents;
export function setEvents(value){
  botEvents = value;
}


app.get('/', (req, res) => {
  if (status === 1) {
    const body = createHtml({body: `<h2>✅ Ya estás logueado en WhatsApp</h2>`})
    res.send(body);
    bot.start()
  }else {
    res.send(defaultLandingPage)
  }
})
app.get('/ping', (req, res) => {
  res.status(200).send('hi')
})

app.use(express.urlencoded({ extended: true }));

app.use('/gifs', express.static(path.join(__dirname, 'gifs')));

app.get('/bot', async (req, res) => {
  const url = decodeURIComponent(req.query.url);
  
  res.send('URL recibida: ' + url);
  while (!bot.isActive) await func.pause()
  
  bot.sendMessage(bot.ownerId, { text: `downloading...` })
  if (url.startsWith('https://www.youtube.com')) {
   /* let ytstream = ytdl(url, {
      filter: 'videoandaudio',
      //quality: res?.query?.quality ?? 'highestvideo'
    })
    console.log('downloading yt')
    return await bot.sendMessage(bot.ownerId, { document: { stream: ytstream }, mimetype: 'video/mp4' });*/
  }
  await bot.sendMessage(bot.ownerId, { document: { url: url }, mimetype: 'video/mp4' });
});
app.get('/owner', (req, res) => {
  res.send(makeMainPage())
})

server.listen(PORT)

const f = { getQR: null, phone: null}

function setStatus(newStatus) {
  status = newStatus
  io.emit('set status', statusText[newStatus])
}

function sendQR(qr) {
  console.log('SEND-QR')
  //console.log('🌟loggedInSocket 👇')
  //console.log('🌟', { loggedInSocket, qr })
  qrcode.toDataURL(qr, function(err, url) {
    io.emit('qr', url)
    console.log('Scan QR in Page ')
  })
}
function sendCode(code){
  console.log("sendCode")
  io.emit('code', code);
  console.log("Code: " + code)
}
function removeQR() {
  if (!loggedInSocket) return
  io.to(loggedInSocket).emit('remove qr')
}

export {
  app,
  f,
  sendQR,
  sendCode,
  setStatus,
  removeQR
};
