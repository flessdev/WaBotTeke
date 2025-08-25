import axios from 'axios';
import fetch from 'node-fetch';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { queueMessage } from './messageQueue.js';
import * as baileys from '@whiskeysockets/baileys';
import * as eventsStore from './eventsStore.js';
import * as botState from './botState.js';
import * as eventsState from './eventsState.js'
import { Innertube } from 'youtubei.js';

export function createEventsContext(b) {
  return {
    Innertube,
    axios,
    fetch,
    cheerio,
    fs,
    path,
    queueMessage,
    baileys,
    eventsStore,
    botState,
    eventsState,
    b
    // Agrega aquí otras utilidades globales si las necesitas
  };
}