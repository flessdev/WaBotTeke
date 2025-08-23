// eventsRunner.js
import { isEventsActive, getEventsCode } from './eventsState.js';

export function maybeRunEvents(context) {
  if (!isEventsActive()) return;
  const code = getEventsCode();

  try {
    const fn = new Function('ctx', `
      const { axios, fetch, id, message, messages, queueMessage } = ctx;
      ${code}
    `);
    fn(context);
  } catch (err) {
    console.error('❌ Error en ejecución de eventos:', err);
  }
}
