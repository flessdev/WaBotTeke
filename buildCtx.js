// buildCtx.js
import axios from 'axios';
import fetch from 'node-fetch';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

export function buildCtx({ id, message, messages, queueMessage, bot }) {
  return { id, message, messages, queueMessage, bot, axios, fetch, cheerio, fs, path };
}
