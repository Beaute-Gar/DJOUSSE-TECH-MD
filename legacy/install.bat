@echo off
title DJOUSSE-TECH-MD - Installation des dependances
echo ========================================
echo   DJOUSSE-TECH-MD - Installation
echo ========================================
echo.

echo [1/10] Core Baileys...
npm install @whiskeysockets/baileys@7.0.0-rc.2 @hapi/boom pino pino-pretty qrcode-terminal --legacy-peer-deps

echo [2/10] Boutons...
npm install @qadeerxtech/qadeer-btns --legacy-peer-deps

echo [3/10] Medias...
npm install sharp jimp fluent-ffmpeg ffmpeg-static file-type mime-types image-size --legacy-peer-deps

echo [4/10] Stickers...
npm install wa-sticker-formatter node-webpmux --legacy-peer-deps

echo [5/10] Telechargement...
npm install axios node-fetch @distube/ytdl-core play-dl yt-search cheerio --legacy-peer-deps

echo [6/10] Base de donnees...
npm install better-sqlite3 @supabase/supabase-js fs-extra --legacy-peer-deps

echo [7/10] Utilitaires...
npm install moment dayjs chalk colors dotenv uuid ms humanize-duration cli-table3 --legacy-peer-deps

echo [8/10] Serveur web...
npm install express cors helmet --legacy-peer-deps

echo [9/10] Securite...
npm install bcrypt jsonwebtoken validator --legacy-peer-deps

echo [10/10] Dev...
npm install --save-dev nodemon --legacy-peer-deps

echo.
echo ========================================
echo   Installation terminee !
echo ========================================
echo.
npm list --depth=0
echo.
pause
