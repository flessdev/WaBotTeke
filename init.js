console.log('🚀 Iniciando bootstrap WA-Bot Cloud...');

// 1️⃣ Cargar todos los satélites de estado y funcionalidad
import './botState.js';
import './qrState.js';
import './eventsState.js';
import './messageQueue.js'; // usa botState internamente
import './eventsContext.js'; // solo declara función de contexto
import './eventsRunner.js'; // runner, queda listo para usar

// 2️⃣ Levantar el servidor HTTP y WS
import './server.js'; // en cuanto se importa, ya arranca

// 3️⃣ Configurar eventos del bot y arrancar conexión
import './index.js'; // registra when_ready, when_get_message y llama startBot()

console.log('✅ Bootstrap finalizado: Server y Bot en marcha');
