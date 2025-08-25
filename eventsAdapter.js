// eventsAdapter.js
import { createEventsContext } from './eventsContext.js';
import { run as runEvents } from './events.js';

export async function runEventsFromWA(b) {
  const ctx = createEventsContext(b);
  await runEvents(ctx);
}
