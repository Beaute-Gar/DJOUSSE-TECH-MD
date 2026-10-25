@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title DJOUSSE-TECH-MD - Migration de l'arborescence
cd /d "%~dp0"

rem =====================================================================
rem  migrer.cmd - migration COMPLETE de DJOUSSE-TECH-MD vers la structure
rem    src / web / deployment / storage
rem
rem  A placer a la racine du projet, a cote de migrate-structure.js.
rem  Double-clic ou : migrer.cmd      (option : migrer.cmd /oui = sans question)
rem
rem  Etapes : 1 controles - 2 arret du bot - 3 sauvegarde - 4 commit de
rem           securite - 5 simulation - 6 confirmation - 7 migration -
rem           8 verification et commit final.
rem  Rien n'est modifie avant l'etape 7. Un message clair s'affiche a la
rem  moindre erreur et le script s'arrete.
rem =====================================================================

set "LOG=%~dp0migration-log.txt"
> "%LOG%" echo === Migration DJOUSSE-TECH-MD - %DATE% %TIME% ===
set "MSG="
set "LOCKED="
set "BK="

echo.
echo ======================================================================
echo   DJOUSSE-TECH-MD - migration vers la nouvelle arborescence
echo ======================================================================
echo.

rem ---------------------------------------------------------------- 1/8
echo [1/8] Controles de l'environnement...
if not exist "index.js" (
  set "MSG=index.js introuvable : lance ce script depuis la racine du projet."
  goto :abort
)
if not exist "handler.js" (
  if exist "src\handlers\handler.js" (
    echo.
    echo La migration est DEJA faite ^(src\handlers\handler.js existe^). Rien a faire.
    goto :end
  )
  set "MSG=handler.js introuvable : ce n'est pas la racine du projet."
  goto :abort
)
if not exist "package.json" (
  set "MSG=package.json introuvable."
  goto :abort
)
if not exist "migrate-structure.js" (
  set "MSG=migrate-structure.js introuvable : place-le dans le meme dossier que migrer.cmd."
  goto :abort
)
where node >nul 2>&1
if errorlevel 1 (
  set "MSG=Node.js n'est pas installe ou pas dans le PATH."
  goto :abort
)
where git >nul 2>&1
if errorlevel 1 (
  set "MSG=Git n'est pas installe ou pas dans le PATH (necessaire pour la securite)."
  goto :abort
)
if not exist ".git" (
  set "MSG=Ce dossier n'est pas un depot git (.git absent). Migration refusee par securite."
  goto :abort
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)"
if errorlevel 1 (
  echo   ATTENTION : Node.js ^< 22.5 detecte. Le bot a besoin de Node 22.5 ou plus ^(base SQLite^).
  >>"%LOG%" echo [AVERT] Node inferieur a 22.5
)
>>"%LOG%" echo [OK] controles
echo   OK.

rem ---------------------------------------------------------------- 2/8
echo.
echo [2/8] Arret du bot...
if exist "scripts\service.js" (
  node scripts\service.js bot stop
)
rem Test de verrouillage : un fichier ouvert par le bot ne peut pas etre renomme.
for %%F in ("data\bot.db" "data\bot.db-wal" "logs\bot.log" "storage\data\bot.db") do (
  if exist "%%~F" (
    ren "%%~F" "%%~nxF.lockcheck" >nul 2>&1
    if errorlevel 1 (
      set "LOCKED=%%~F"
    ) else (
      ren "%%~F.lockcheck" "%%~nxF" >nul 2>&1
    )
  )
)
if defined LOCKED (
  set "MSG=Le fichier %LOCKED% est utilise : le bot tourne encore. Ferme sa fenetre ou termine le processus node dans le Gestionnaire des taches, puis relance."
  goto :abort
)
>>"%LOG%" echo [OK] bot arrete
echo   OK.

rem ---------------------------------------------------------------- 3/8
echo.
echo [3/8] Sauvegarde des fichiers hors git ^(session, donnees, .env^)...
set "STAMP=sauvegarde"
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%i"
set "BK=%~dp0..\sauvegarde_migration_%STAMP%"
mkdir "%BK%" >nul 2>&1
if not exist "%BK%" (
  set "MSG=Impossible de creer le dossier de sauvegarde : %BK%"
  goto :abort
)
if exist "sessions\" (
  robocopy "sessions" "%BK%\sessions" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 (
    set "MSG=Echec de la sauvegarde de sessions."
    goto :abort
  )
)
if exist "data\" (
  robocopy "data" "%BK%\data" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 (
    set "MSG=Echec de la sauvegarde de data."
    goto :abort
  )
)
if exist "plugins\data\" (
  robocopy "plugins\data" "%BK%\plugins_data" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 (
    set "MSG=Echec de la sauvegarde de plugins\data."
    goto :abort
  )
)
if exist ".env" copy /Y ".env" "%BK%\.env" >nul
if exist ".env.local" copy /Y ".env.local" "%BK%\.env.local" >nul
>>"%LOG%" echo [OK] sauvegarde : %BK%
echo   OK  -^>  %BK%
echo   ^(contient tes secrets : ne la partage jamais^)

rem ---------------------------------------------------------------- 4/8
echo.
echo [4/8] Commit de securite ^(etat actuel du code^)...
git add -A >>"%LOG%" 2>&1
if errorlevel 1 (
  set "MSG=git add a echoue (voir migration-log.txt)."
  goto :abort
)
rem Garde-fou : aucun secret ne doit etre commite.
git diff --cached --name-only | findstr /I /R /C:"^\.env$" /C:"^\.env\." /C:"creds\.json" /C:"^sessions/" /C:"^data/bot" /C:"\.pid$" >nul 2>&1
if not errorlevel 1 (
  git reset -q >nul 2>&1
  set "MSG=Un fichier secret (.env, session...) allait etre commite. Annule. Verifie ton .gitignore avant de relancer."
  goto :abort
)
git diff --cached --quiet
if errorlevel 1 (
  git config user.email >nul 2>&1
  if errorlevel 1 (
    git -c user.name="Djousse" -c user.email="djousse@localhost" commit -q -m "avant restructuration (sauvegarde automatique)" >>"%LOG%" 2>&1
  ) else (
    git commit -q -m "avant restructuration (sauvegarde automatique)" >>"%LOG%" 2>&1
  )
  if errorlevel 1 (
    set "MSG=git commit a echoue (voir migration-log.txt)."
    goto :abort
  )
  echo   Commit cree.
) else (
  echo   Rien a commiter : le depot est deja propre.
)
>>"%LOG%" echo [OK] commit de securite
echo   OK.

rem ---------------------------------------------------------------- 5/8
echo.
echo [5/8] Simulation ^(rien n'est ecrit^)...
echo ----------------------------------------------------------------------
node migrate-structure.js
if errorlevel 1 (
  set "MSG=La simulation signale une erreur : rien n'a ete modifie. Lis le message ci-dessus."
  goto :abort
)
echo ----------------------------------------------------------------------
>>"%LOG%" echo [OK] simulation

rem ---------------------------------------------------------------- 6/8
echo.
echo [6/8] Confirmation
if /I "%~1"=="/oui" goto :apply
set "REP="
set /p "REP=Appliquer la migration maintenant ? Tape O puis Entree pour continuer : "
if /I not "%REP%"=="O" (
  echo.
  echo Annule. Rien n'a ete modifie ^(seul le commit de securite existe^).
  >>"%LOG%" echo [INFO] annule par l'utilisateur
  goto :end
)

rem ---------------------------------------------------------------- 7/8
:apply
echo.
echo [7/8] Migration en cours...
node migrate-structure.js --apply
if errorlevel 1 (
  set "MSG=La migration a echoue. Les deplacements ont ete annules par le script. Pour revenir a l'etat d'avant : git reset --hard  (tes donnees sont aussi dans %BK%)."
  goto :abort
)
>>"%LOG%" echo [OK] migration appliquee
echo   OK.

rem ---------------------------------------------------------------- 8/8
echo.
echo [8/8] Verification...
if not exist "node_modules\" (
  echo   Installation des dependances ^(npm ci^)...
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    set "MSG=npm ci a echoue. Relance 'npm ci' puis 'npm run check'."
    goto :abort
  )
)
echo   - npm run check
call npm run check >>"%LOG%" 2>&1
if errorlevel 1 (
  set "MSG=npm run check a echoue (syntaxe). Voir migration-log.txt. Rien n'a ete commite : git reset --hard pour revenir en arriere."
  goto :abort
)
echo   - npm run audit
call npm run audit >>"%LOG%" 2>&1
if errorlevel 1 (
  set "MSG=npm run audit signale une anomalie. Voir migration-log.txt. Rien n'a ete commite."
  goto :abort
)
echo   - npm test ^(quelques minutes^)
call npm test >>"%LOG%" 2>&1
if errorlevel 1 (
  echo   ATTENTION : certains tests ont echoue. Si ce sont les tests reseau ^(otakugifs, bible-api,
  echo   popcat, urban, thum.io^) et que ton internet est coupe, c'est normal.
  >>"%LOG%" echo [AVERT] tests en echec - voir ci-dessus
) else (
  echo   Tous les tests passent.
)

rem Range les outils de migration dans scripts\archive puis commit final
if not exist "scripts\archive\" mkdir "scripts\archive" >nul 2>&1
if exist "migrate-structure.js" move /Y "migrate-structure.js" "scripts\archive\" >nul 2>&1

git add -A >>"%LOG%" 2>&1
git diff --cached --name-only | findstr /I /R /C:"^\.env$" /C:"^\.env\." /C:"creds\.json" /C:"^storage/" /C:"\.pid$" >nul 2>&1
if not errorlevel 1 (
  git reset -q >nul 2>&1
  set "MSG=Un fichier secret ou genere allait etre commite : commit final annule (la migration, elle, est faite)."
  goto :abort
)
git config user.email >nul 2>&1
if errorlevel 1 (
  git -c user.name="Djousse" -c user.email="djousse@localhost" commit -q -m "refactor: nouvelle arborescence (src, web, deployment, storage)" >>"%LOG%" 2>&1
) else (
  git commit -q -m "refactor: nouvelle arborescence (src, web, deployment, storage)" >>"%LOG%" 2>&1
)
if errorlevel 1 (
  echo   ATTENTION : le commit final n'a pas ete cree ^(voir migration-log.txt^). La migration, elle, est faite.
)
>>"%LOG%" echo [OK] termine

echo.
echo ======================================================================
echo   MIGRATION TERMINEE
echo ======================================================================
echo.
echo   Demarrer le bot       :  npm start
echo   Ta session et tes donnees sont dans  storage\
echo   Sauvegarde de securite :  %BK%
echo.
echo   A FAIRE UNE FOIS sur les services en ligne :
echo     - Vercel : Settings, General, Root Directory = web
echo     - Render : Blueprint Path = deployment/render.yaml
echo     - Pousser sur GitHub : git push
echo.
echo   Detail complet : migration-log.txt
goto :end

rem ------------------------------------------------------------------ fin
:abort
echo.
echo ======================================================================
echo   [ERREUR] %MSG%
echo ======================================================================
echo   Journal : %LOG%
>>"%LOG%" echo [ERREUR] %MSG%
echo.
pause
exit /b 1

:end
echo.
pause
exit /b 0
