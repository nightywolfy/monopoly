@echo off
setlocal
set "file=server.js"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$f='server.js'; ^
$s=[IO.File]::ReadAllText($f); ^
$s=[regex]::Replace($s,'player1bot:createBot\(''player[0-9]+bot''','player1bot:createBot(''player1bot'''); ^
[IO.File]::WriteAllText($f,$s)"

echo Done.
