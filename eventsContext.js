import axios from 'axios';
import fetch from 'node-fetch';

export function createEventsContext({ id, message, messages, queueMessage }) {
  return {
    axios,
    fetch,
    id,
    message,
    messages,
    queueMessage
    // Agrega aquí otras utilidades globales si las necesitas
  };
}