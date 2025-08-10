import * as bot from './bot.js';
import * as server from './server.js';
import got from 'got';

console.log('INDEX EJECUTADO')

process.on('unhandledRejection', async error => {
  console.error('UnhandledRejection:', error);
  if(server.getStatus() == 1) {
    bot.sendMessage(bot.ownerId, {text: 'UnhandledRejection: '+ error.stack })
    setTimeout(() => process.exit(1), 100);
    return
  }
  process.exit(1)
});

const events = {}
events.when_ready = async function() {
  bot.sendMessage(bot.ownerId, { text: 'Connected' })
}


events.when_get_message = async function(id, message) {
  if (message.startsWith('hi')) {
    bot.queueMessage(id, { text: 'Hello ' });
  }

  
  if (message.startsWith('-page')) {
    let link = message.slice(5);
    console.log('Downloading page', '👇')
    bot.sendMessage(id, { text: `downloading...` })
    bot.sendMessage(id, { document: { url: link }, mimetype: 'text/html' });
  }
  if (message.startsWith('-site')) {
    let link = message.slice(5);
    console.log('Downloading page', '👇')
    bot.sendMessage(id, { text: `downloading...` })
    got(link).then(result => {
      console.log(result.body);
      bot.sendMessage(id, { document: { url: link }, mimetype: 'text/html' });
    }).catch(err => {
      console.log(err);
    });

  }



}

//bot.start(events)
bot.setEvents(events)
bot.start()