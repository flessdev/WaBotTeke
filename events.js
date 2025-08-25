import { maybeRunEvents } from './eventsRunner.js';
export async function run(ctx){
  console.log("events run")
  maybeRunEvents(ctx); //anotherEvents
  
  const {b, baileys, botState, eventsState, eventsStore, queueMessage, axios, fetch, cheerio, fs, path} = ctx;
  const bot = b;
  let m = b.messages[0];
  const text = m.message?.conversation ||
    m.message?.extendedTextMessage?.text || "";
  //console.log("TEXT: " + JSON.stringify(m, null, 2))
  const id = m?.key?.remoteJid || botState.getOwnerJid();
  const contentType = baileys?.getContentType(m?.message);
  const caption = m?.message?.[contentType]?.caption || "";
  const mimetype = m?.message?.[contentType]?.mimetype || ""
  const m_url = m?.message?.[contentType]?.url || "";

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
  
  if (caption == '-setevents') {
    if (contentType === 'documentMessage') {
      if (mimetype === 'text/plain' || mimetype == "application/javascript") {
        const buffer = await baileys.downloadMediaMessage(m, 'buffer', {});
        const text = buffer.toString('utf8');
        await eventsStore.saveEvents('default', text); // guarda en PG
        //fs.writeFileSync('./eventos.txt', buffer)
        queueMessage(id, { text: 'Archivo de eventos guardado ✅' })
      } else {
        queueMessage(id, { text: 'Por favor envía un archivo .txt 📄' })
      }
    } else {
      queueMessage(id, { text: 'Debes adjuntar un archivo .txt junto al comando.' })
    }
  }
  if (text === '-getevents') {
    const content = await eventsStore.getEvents('default');
    queueMessage(id, { text: content || 'No hay eventos guardados.' });
  }
  if (text === '-enableevents') {
    const content = await eventsStore.getEvents('default');
    if (content) {
      eventsState.setEventsCode(content);
      eventsState.setEventsActive(true);
      queueMessage(id, { text: 'eventos activados' });
    } else {
      queueMessage(id, { text: 'No hay eventos guardados.' });
    }
  }
  
  if (text.startsWith('-hola')) {
    queueMessage(id, { text: 'Hello World' })
  }

  if (text === '-off') {
    process.exit(0);
  }
 
  if (text.startsWith('-doc')) {
    const url = text.slice(4).trim();
    console.log('Downloading...', url, '👇');
    queueMessage(id, { text: `Downloading... 👇` });
    try {
        let res;
        let fallbackUsed = false;
        let signatureUsed = false;
        let firstChunk;

        try {
          // Plan A: HEAD
          res = await axios.head(url, { timeout: 5000 });
        } catch {
          try{
            // Plan B: GET parcial (1 KB)
            fallbackUsed = true;
            const partialRes = await axios.get(url, {
              timeout: 5000,
              responseType: 'arraybuffer',
              headers: { Range: 'bytes=0-1023' }
            });
            res = { headers: partialRes.headers };
            res.headers['content-length'] = res.headers['content-range']?.split('/')[1] || res.headers['content-length'];
            firstChunk = Buffer.from(partialRes.data);
          }catch(e){
            console.error("ERROR ENLACE INVÁLIDO: "+ e);
            return queueMessage(id, { text: "URL inválida:\n" + e.stack})
          }
        }

        let mimetype = res.headers['content-type']?.split(';')[0]?.trim() || '';

        // Nombre del archivo
        const rawName =
          res.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1] ||
          url.split('/').pop()?.split('?')[0] ||
          'desconocido';

        let filename = rawName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
        if (filename.length > 50) {
          const ext = path.extname(filename);
          filename = filename.slice(0, 50 - ext.length).trim() + ext;
        }

        // Si el mimetype no es fiable, usar extensión
        if (!mimetype || mimetype === 'application/octet-stream') {
          const ext = path.extname(filename);
          const detected = mime.lookup(ext);
          if (detected) mimetype = detected;
        }

        // Plan C: detectar por firma binaria si sigue sin saberse
        if ((!mimetype || mimetype === 'application/octet-stream') && !firstChunk) {
          // Descargar solo primeros bytes si no se obtuvieron en Plan B
          const partialRes = await axios.get(url, {
            timeout: 5000,
            responseType: 'arraybuffer',
            headers: { Range: 'bytes=0-1023' }
          });
          firstChunk = Buffer.from(partialRes.data);
        }
        if (firstChunk && (!mimetype || mimetype === 'application/octet-stream')) {
          const type = await fileType.fromBuffer(firstChunk);
          if (type) {
            mimetype = type.mime;
            const ext = path.extname(filename) || `.${type.ext}`;
            if (!path.extname(filename)) filename += `.${type.ext}`;
            signatureUsed = true;
          }
        }

        const sizeBytes = Number(res.headers['content-length'] || 0);
        const formatSize = (bytes) => {
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
          if (bytes < 1024 ** 3) {
            const mb = bytes / 1024 ** 2;
            return mb < 10 ? `${mb.toFixed(2)} MB` : `${Math.round(mb)} MB`;
          }
          const gb = bytes / 1024 ** 3;
          return gb < 10 ? `${gb.toFixed(2)} GB` : `${Math.round(gb)} GB`;
        };

        let info = `Archivo: ${filename}\nTipo: ${mimetype}\nTamaño: ${formatSize(sizeBytes)}`;
        if (fallbackUsed) info += `\n⚠️ No se pudo hacer HEAD, se usó GET parcial para obtener metadatos.`;
        if (signatureUsed) info += `\n🔍 Tipo deducido por firma binaria.`;

        queueMessage(id, { text: info });

      // Enviar archivo con nombre y tipo
      return queueMessage(id, {
        document: { url: url },
        mimetype,
        fileName: filename
      });
      return;
    } catch (e) {
      console.error(e);
      return queueMessage(id, { text: e.stack })
    }

  }
}