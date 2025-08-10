import axios from 'axios';
import fs from 'fs';
import * as bot from './bot.js'

async function sendByChunks(id, url, chunkSizeMB = 1, rest = 0) {
  try {
    const response = await axios.head(url);
    const info = await ytdl.getInfo(url, {filter: 'videoandaudio',
        quality: 'highestvideo'
});
    console.log(info)
    const totalSize = parseInt(response.headers['content-length'], 10);
    let chunkSize = chunkSizeMB * 1000 * 1000
    let startf = 0;
    let endf = startf + chunkSize - 1;

    while (startf < totalSize) {
      if (endf >= totalSize) {
        endf = totalSize - 1;
      }

     /* let ytstream = await ytdl(url, {
        filter: 'videoandaudio',
        quality: 'highestvideo',
        range: {start: startf, end: endf}
      })
      console.log(`downloading yt: ${startf} ${endf}`)
      bot.session.sendMessage(id, { document: { stream: ytstream } });*/
    }

    startf += chunkSize;
    endf = startf + chunkSize - 1;

    await pause(rest * 1000);
  }
  catch(error){
    console.log('Error al descargar el archivo:', error);
  }
}










async function downloadFile(id, url, chunkSizeMB, rest) {
  try {
    const response = await axios.head(url);
    const totalSize = parseInt(response.headers['content-length'], 10);
    let chunkSize = chunkSizeMB * 1000 * 1000
    let start = 0;
    let end = start + chunkSize - 1;

    const writeStream = fs.createWriteStream(file, { flags: 'a' });

    while (start < totalSize) {
      if (end >= totalSize) {
        end = totalSize - 1;
      }

      ///await downloadChunk(url, start, end, writeStream);

      start += chunkSize;
      end = start + chunkSize - 1;

      await pause(rest * 1000);
    }

    writeStream.end();
    console.log('Descarga completada');
    //callback(null);
  } catch (error) {
    console.log('Error al descargar el archivo:', error);
    //callback(error);
  }
}

async function downloadChunk(url, start, end, writeStream) {
  try {
    const rangeHeader = `bytes=${start}-${end}`;
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        Range: rangeHeader,
      },
    });

    await response.data.pipe(writeStream);

    /*await new Promise((resolve) => {
      writeStream.on('finish', resolve);
    });*/

    console.log(`Pedazo descargado: ${start}-${end}`);
  } catch (error) {
    console.log('Error al descargar el fragmento:', error);
  }
}

function pause(ms = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*Ejemplo de uso
const url = 'URL_DEL_ARCHIVO';
const file = 'RUTA_DEL_ARCHIVO';
const chunkSize = 1; // Tamaño de cada chunk en megabytes
const rest = 30; // Tiempo de descanso después de cada chunk en segundos

downloadFile(url, file, chunkSize, rest, (error) => {
  if (error) {
    console.log('Error en la descarga:', error);
  } else {
    console.log('Proceso de descarga completado');
  }
});*/


export { downloadFile, sendByChunks, pause}