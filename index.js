import * as bot from './bot.js';
import * as server from './server.js';
import got from 'got';
import fs from 'fs';
import fetch from 'node-fetch';
import { load } from 'cheerio';
import axios from 'axios';
import { saveEvents, getEvents } from './eventsStore.js';

//import { startGlobalWatcher, restoreAll } from "./autosync.js";

//await restoreAll(); // Trae los datos guardados antes de iniciar el bot
//startGlobalWatcher();           // Empieza a vigilar cambios y sincronizar

console.log('INDEX EJECUTADO')
let anotherEventsIsActive = false;
let anotherEvents = {};


process.on('unhandledRejection', async error => {
  console.error('UnhandledRejection:', error);
  if (server.getStatus() == 1) {
    bot.sendMessage(bot.ownerJid, { text: 'UnhandledRejection: ' + error.stack })
    setTimeout(() => process.exit(1), 100);
    return
  }
  process.exit(1)
});

function readFile(file) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function writeEventsFile(content) {
  fs.writeFileSync(EVENTS_FILE, content, 'utf8');
}

const events = {}
events.when_ready = async function() {
  bot.sendMessage(bot.ownerJid, { text: 'Connected' })
}

events.when_get_message = async function(id, message) {
  if (message.startsWith('-hi')) {
    bot.queueMessage(id, { text: 'Hello' });
  }
  if (message == "-off") {
    process.exit(0);
  }
  if (message.startsWith('-setFDN ')) {
    const FDN = message.slice(8);
    server.setFullDomainName(FDN);
    bot.queueMessage(id, { text: FDN + " establecido" })
    const res = await server.ping()
    bot.queueMessage(id, { text: res });
    if (res != 'hi') return;
    server.startAutoPing();

  }
  if (message == '-getvents') {
    const content = await getEvents('default');
    if (content) {
      bot.queueMessage(id, { text: content });
    } else {
      bot.queueMessage(id, { text: 'No hay eventos guardados.' });
    }
    /*bot.queueMessage(id, {
      document: { url: './eventos.txt' },
      mimetype: 'text/plain',
      filename: 'events.txt'
    });*/
  }
  if (message == '-enableevents') {
    const content = await getEvents('default');
    if (content) {
      anotherEvents = content;
      anotherEventsIsActive = true;
      bot.queueMessage(id, { text: 'eventos añadidos' });
    } else {
      bot.queueMessage(id, { text: 'No hay eventos guardados.' });
    }
    /*anotherEvents = readFile('./eventos.txt')
    anotherEventsIsActive = true
    bot.queueMessage(id, {text: "eventos añadidos"})*/
  }
  if (anotherEventsIsActive) {
    //console.log(anotherEvents)
    eval(anotherEvents)
  }
}

//bot.start(events)
bot.setEvents(events)
bot.start()