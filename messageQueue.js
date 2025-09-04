import { getIsActive } from './botState.js';

const queue = [];
let isSending = false;
let senderFn = null;

export const injectSender = fn => { senderFn = fn };

export function queueMessage(jid, content) {
  queue.push({ jid, content });
  if (!isSending) processQueue();
}

async function processQueue() {
  if (queue.length === 0) {
    isSending = false;
    return;
  }
  setTimeout(processQueue, 1000);

  isSending = true;
  const { jid, content } = queue.shift();

  if (getIsActive() && senderFn) {
    try {
      await senderFn(jid, content); // espera envío real
    } catch (err) {
      console.error('❌ Error al enviar:', err);
    }
  }

  // espera 1 segundo antes de siguiente envío
  
}
