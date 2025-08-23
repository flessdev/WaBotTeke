// events7.commands.js
import { addCommands } from './commandEngine.js';

addCommands({
  '-hello': async (ctx) => {
    ctx.queueMessage(ctx.id, { text: 'Hello Feo' });
  },
  '-html': async (ctx, url) => {
    if (!url) return ctx.queueMessage(ctx.id, { text: 'Falta la URL' });
    ctx.queueMessage(ctx.id, { text: 'descargando...' });
    // ... tu lógica fetch + cheerio ...
  },
  '-mp4': async (ctx, link) => {
    ctx.queueMessage(ctx.id, { text: 'downloading...' });
    // ... lógica HEAD y enviar video ...
  },
  // ... resto de comandos como propiedades ...
});
