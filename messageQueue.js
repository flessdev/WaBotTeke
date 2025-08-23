import { getIsActive } from './botState.js';

const queue = [];
let isSending = false;
let senderFn = null; // inyectado desde bot.js

export const injectSender = fn => { senderFn = fn };

export function queueMessage(jid, content) {
  queue.push({ jid, content });
  processQueue();
}

function processQueue() {
  setTimeout(() => {
    isSending = false;
    processQueue();
  }, 1000);

  if (isSending || queue.length === 0) return;
  isSending = true;

  const { jid, content } = queue.shift();
  if (!getIsActive() || !senderFn) return;

  senderFn(jid, content).catch(err => {
    console.error('❌ Error al enviar:', err);
  });
}