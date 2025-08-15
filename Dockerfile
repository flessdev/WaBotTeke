# Imagen base de Node.js
FROM node:20

# Carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiamos package.json y package-lock.json (si existe)
COPY package*.json ./

# Instalamos dependencias
RUN npm install --production

# Copiamos el resto de archivos
COPY . .

# Definimos la variable de entorno PORT
ENV PORT=3003

# Exponemos el puerto
EXPOSE ${PORT}

# Comando para iniciar tu bot
CMD ["node", "index.js"]