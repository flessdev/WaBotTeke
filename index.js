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
  if (text.startsWith('-hi')) {
    queueMessage(id, { text: 'Hello' });
  }
  const ctx = createEventsContext(b);
  maybeRunEvents(ctx);
  /*if (text.startsWith('-setFDN')) {
    const FDN = text.slice(7).split();
    setFullDomainName(FDN);
    queueMessage(id, { text: `${FDN} establecido` });
    const res = await ping();
    queueMessage(id, { text: res });
    if (res === 'hi') startAutoPing();
  }*/
  
};

setBotEvents(events);
startBot();