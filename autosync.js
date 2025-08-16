import { Client, Storage } from "node-appwrite";
import chokidar from "chokidar";
import fs from "fs";
import path from "path";

// Configuración Appwrite
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const storage = new Storage(client);

const ROOT_DIR = process.cwd();
const IGNORE_FILE = path.join(ROOT_DIR, ".syncignore");

// Lee patrones de .syncignore
function loadIgnorePatterns() {
  if (!fs.existsSync(IGNORE_FILE)) return [];
  return fs
    .readFileSync(IGNORE_FILE, "utf8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#")); // Ignora líneas vacías o comentarios
}

function getFileId(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  return relativePath.replace(/[\/\\]/g, "_");
}

async function uploadFile(filePath) {
  const fileId = getFileId(filePath);
  await storage.createFile(
    process.env.APPWRITE_BUCKET_ID,
    fileId,
    fs.createReadStream(filePath)
  );
  console.log(`📤 Subido/actualizado: ${path.relative(ROOT_DIR, filePath)}`);
}

async function deleteFile(filePath) {
  const fileId = getFileId(filePath);
  try {
    await storage.deleteFile(process.env.APPWRITE_BUCKET_ID, fileId);
    console.log(`🗑 Eliminado en Appwrite: ${path.relative(ROOT_DIR, filePath)}`);
  } catch {
    console.warn(`⚠ No se encontró en Appwrite: ${filePath}`);
  }
}

export async function restoreAll() {
  const filesList = await storage.listFiles(process.env.APPWRITE_BUCKET_ID);
  for (const file of filesList.files) {
    const localPath = path.join(ROOT_DIR, file.$id.replace(/_/g, path.sep));
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    const fileStream = await storage.getFileDownload(
      process.env.APPWRITE_BUCKET_ID,
      file.$id
    );
    fileStream.pipe(fs.createWriteStream(localPath));
    console.log(`📥 Restaurado: ${localPath}`);
  }
}

export function startGlobalWatcher() {
  const ignorePatterns = loadIgnorePatterns();
  chokidar
    .watch(ROOT_DIR, {
      ignored: ignorePatterns,
      ignoreInitial: false,
      persistent: true
    })
    .on("add", uploadFile)
    .on("change", uploadFile)
    .on("unlink", deleteFile);
}
