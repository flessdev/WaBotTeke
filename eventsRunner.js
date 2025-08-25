// eventsRunner.js
import { isEventsActive, getEventsCode } from './eventsState.js';
import { queueMessage } from './messageQueue.js';
import { getOwnerJid } from './botState.js';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export async function runUserCode(context, code) {
    const filename = 'events-code.js';

    // Clonar globals actuales
    const sandbox = { ...globalThis };

    // Extras de Node que no siempre están en globalThis
    sandbox.require = createRequire(import.meta.url);
    sandbox.__filename = fileURLToPath(import.meta.url);
    sandbox.__dirname = dirname(sandbox.__filename);
    sandbox.module = { exports: {} };
    sandbox.exports = sandbox.module.exports;

    // Inyectar tu propio contexto
    sandbox.ctx = context;

    // Crear contexto VM
    vm.createContext(sandbox);
    try {
      const script = new vm.Script(code, {
        filename,
        importModuleDynamically: async (specifier) => {
          // Resolver como ESM usando la API estándar de Node
          const resolved = require.resolve(specifier, { paths: [__dirname] });
          return import(pathToFileURL(resolved).href);
        }
      });
      await script.runInContext(sandbox, {
        importModuleDynamically: async (specifier) => {
          const resolved = require.resolve(specifier, { paths: [__dirname] });
          return import(pathToFileURL(resolved).href);
        }
      });
    } catch (err) {
      queueMessage(getOwnerJid(), { text: err.stack });
      console.error('❌ Error en ejecución de eventos:', err);
    }
}

export async function maybeRunEvents(context) {
  if (!isEventsActive()) return;
  const code = getEventsCode();
  runUserCode(context, code);
  /*try {
    const fn = new Function('ctx', code);
    await fn(context);
  } catch (err) {
    console.error('❌ Error en ejecución de eventos:', err);
  }*/
}
