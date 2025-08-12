import * as bot from './bot.js';
import * as server from './server.js';
import got from 'got';
import fs from 'fs';

console.log('INDEX EJECUTADO')
let anotherEventsIsActive = false;
const anotherEvents = {};


process.on('unhandledRejection', async error => {
  console.error('UnhandledRejection:', error);
  if(server.getStatus() == 1) {
    bot.sendMessage(bot.ownerId, {text: 'UnhandledRejection: '+ error.stack })
    setTimeout(() => process.exit(1), 100);
    return
  }
  process.exit(1)
});

function readEventsFile() {
  if (!fs.existsSync(EVENTS_FILE)) return '';
  return fs.readFileSync(EVENTS_FILE, 'utf8');
}
function writeEventsFile(content) {
  fs.writeFileSync(EVENTS_FILE, content, 'utf8');
}

const events = {}
events.when_ready = async function() {
  bot.sendMessage(bot.ownerId, { text: 'Connected' })
}

events.when_get_message = async function(id, message) {
  if (message.startsWith('-hi')) {
    bot.queueMessage(id, { text: 'Hello ' });
  }
  if (message.equals('get events')) {
    const events = readEventsFile();
    bot.queueMessage(id, { text: events });
  }
  if(message.equals('set events')){
    
  }
  if(anotherEventsIsActive) eval(anotherEvents)
}

//bot.start(events)
bot.setEvents(events)
bot.start()