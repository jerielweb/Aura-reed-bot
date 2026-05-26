# Aura Reed Bot

Bot de WhatsApp para grupos y uso personal, construido con `@whiskeysockets/baileys` y un sistema modular de comandos.

## 📌 Descripción

Aura Reed Bot es un bot de WhatsApp con comandos de entretenimiento, administración de grupos, utilidades, stickers y más. Está diseñado para cargarse automáticamente desde la carpeta `commands/` y usar archivos JSON locales para mantener la configuración y datos.

## 🚀 Características

- Soporte modular de comandos
- Integración con WhatsApp Web vía Baileys
- Comandos de diversión (`8bal`, `top`, etc.)
- Mensajes con estilo personalizado del bot
- Gestión de base de datos local en `database/`
- Reconexión automática cuando se cierra la sesión

## 🧱 Requisitos

- Node.js 18+ o Bun
- WhatsApp con sesión válida
- Internet

## 📦 Instalación

Desde la carpeta del proyecto:

```bash
npm install
# o si usas Bun
bun install
```

## ▶️ Uso

Ejecuta el bot con:

```bash
npm start
```

Para desarrollo con recarga automática (si usas Bun):

```bash
npm run dev
```

## ⚙️ Configuración inicial

En la primera instalación, el script `postinstall` crea automáticamente las carpetas y archivos básicos:

- `database/database.json`
- `database/users.json`
- `database/groups.json`
- `sessions/subbots/`
- `tmp/`

Asegúrate de editar `database/database.json` si necesitas cambiar el prefijo o los propietarios del bot.

## 💬 Comandos básicos

El bot carga comandos desde `commands/` y usa un prefijo configurado en `database/database.json`.

Ejemplos:

- `!8bal <pregunta>` → Respuesta estilo bola 8
- `!top <tema>` → Genera un top 10 aleatorio del grupo

> Si tu prefijo es distinto a `!`, reemplázalo por el configurado en `database/database.json`.

## 🧩 Estructura de carpetas

- `commands/` → comandos del bot
- `controllers/` → lógica de manejo de mensajes y eventos
- `models/` → utilidades y estructura de datos
- `database/` → archivos JSON de configuración y datos
- `auth_info_baileys/` → credenciales de WhatsApp
- `sessions/` → sesiones y bots secundarios
- `tmp/` → archivos temporales

## 💡 Notas

- El bot vuelve a conectarse automáticamente si la sesión se cierra.
- La base de datos local se guarda con `saveDB` al interactuar con mensajes y grupos.

## 🛠️ Contribuir

1. Haz un fork del repositorio.
2. Crea una rama con tu cambio.
3. Envía un pull request.

## 📄 Licencia

Este proyecto usa licencia `MIT`.
