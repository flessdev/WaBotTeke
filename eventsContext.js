import axios from 'axios';
import fetch from 'node-fetch';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';


import {queueMessage } from './messageQueue.js';

export function createEventsContext(b) {
  return {
    axios,
    fetch,
    cheerio,
    fs,
    path,
    b
    // Agrega aquí otras utilidades globales si las necesitas
  };
}