import { getOwnerJid } from './botState.js';
import { queueMessage, start as startBot, setEvents as setBotEvents } from './bot.js';
import { setFullDomainName, startAutoPing, ping } from './server.js';
import { setEventsActive, setEventsCode } from './eventsState.js';
import { createEventsContext } from './eventsContext.js';
import { maybeRunEvents } from './eventsRunner.js';

console.log('INDEX EJECUTADO');

const events = {};
events.when_ready = async () => {
  queueMessage(getOwnerJid(), { text: 'Connected' });
};

events.when_get_message = async (b) => {
  let m = b.messages[0];
  const text = m.message?.conversation ||
    m.message?.extendedTextMessage?.text || "";
  let id = m.key?.remoteJid;
  const contentType = b.getContentType(m.message);
  const caption = m.message[contentType]?.caption || "";
  const mimetype = m.message[contentType]?.mimetype || ""
  const m_url = m.message[contentType]?.url || "";


  if (text.startsWith('-hi')) {
    queueMessage(id, { text: 'Hello' });
  }
  if (text === '-off') {
    process.exit(0);
  }
  /*if (text.startsWith('-setFDN')) {
    const FDN = text.slice(7).split();
    setFullDomainName(FDN);
    queueMessage(id, { text: `${FDN} establecido` });
    const res = await ping();
    queueMessage(id, { text: res });
    if (res === 'hi') startAutoPing();
  }*/
  if (caption == '-setevents') {
    if (contentType === 'documentMessage') {
      if (mimetype === 'text/plain' || mimetype == "application/javascript") {
        const buffer = await b.downloadMediaMessage(m, 'buffer', {});
        const text = buffer.toString('utf8');
        await b.eventsStore.saveEvents('default', text); // guarda en PG
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
    const content = await b.eventsStore.getEvents('default');
    queueMessage(id, { text: content || 'No hay eventos guardados.' });
  }
  if (text === '-enableevents') {
    const content = await b.eventsStore.getEvents('default');
    if (content) {
      setEventsCode(content);
      setEventsActive(true);
      queueMessage(id, { text: 'eventos activados' });
    } else {
      queueMessage(id, { text: 'No hay eventos guardados.' });
    }
  }

  // 🚀 Ejecutar el script dinámico con contexto inyectado
  const ctx = createEventsContext(b);
  maybeRunEvents(ctx);
};

setBotEvents(events);
startBot();