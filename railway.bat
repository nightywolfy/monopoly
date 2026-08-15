@echo off
setlocal
set "file=server.js"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$f='server.js'; ^
$s=[IO.File]::ReadAllText($f); ^
$s=[regex]::Replace($s,'player1bot:createBot\(''player[0-9]+bot''','player1bot:createBot(''player1bot'''); ^
$s=[regex]::Replace($s,'player2bot:createBot\(''player[0-9]+bot''','player2bot:createBot(''player2bot'''); ^
[IO.File]::WriteAllText($f,$s)"

echo Done.
