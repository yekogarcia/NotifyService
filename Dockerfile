# --- ETAPA 1: Compilación ---
FROM node:24-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (incluyendo las de desarrollo para poder compilar)
RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Compilar el proyecto (esto genera la carpeta /dist)
RUN npm run build

# --- ETAPA 2: Producción ---
FROM node:24-alpine AS runner

WORKDIR /app

COPY package*.json ./

# Instalar SOLAMENTE dependencias de producción para ahorrar espacio
RUN npm ci --only=production

# Copiar la carpeta compilada desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Puerto interno por defecto de NestJS
EXPOSE 3000

# Comando para arrancar en producción
CMD ["node", "dist/src/main"]