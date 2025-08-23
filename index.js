import { getOwnerJid } from './botState.js';
import { queueMessage, start as startBot, setEvents as setBotEvents } from './bot.js';
import { setFullDomainName, startAutoPing, ping } from './server.js';
import { getEvents } from './eventsStore.js';
import { setEventsActive, setEventsCode } from './eventsState.js';
import { createEventsContext } from './eventsContext.js';
import { maybeRunEvents } from './eventsRunner.js';

console.log('INDEX EJECUTADO');

const events = {};
events.when_ready = async () => {
  queueMessage(getOwnerJid(), { text: 'Connected' });
};

events.when_get_message = async (id, message, messages) => {
  if (message.startsWith('-hi')) {
    queueMessage(id, { text: 'Hello' });
  }
  if (message === '-off') {
    process.exit(0);
  }
  if (message.startsWith('-setFDN ')) {
    const FDN = message.slice(8);
    setFullDomainName(FDN);
    queueMessage(id, { text: `${FDN} establecido` });
    const res = await ping();
    queueMessage(id, { text: res });
    if (res === 'hi') startAutoPing();
  }
  if (message === '-getevents') {
    const content = await getEvents('default');
    queueMessage(id, { text: content || 'No hay eventos guardados.' });
  }
  if (message === '-enableevents') {
    const content = await getEvents('default');
    if (content) {
      setEventsCode(content);
      setEventsActive(true);
      queueMessage(id, { text: 'eventos activados' });
    } else {
      queueMessage(id, { text: 'No hay eventos guardados.' });
    }
  }

  // 🚀 Ejecutar el script dinámico con contexto inyectado
  const ctx = createEventsContext({ id, message, messages, queueMessage });
  maybeRunEvents(ctx);
};

setBotEvents(events);
startBot();
