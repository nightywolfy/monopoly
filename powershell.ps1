Get-ChildItem *.html | ForEach-Object {
    (Get-Content $_.FullName -Raw) -replace 'map3\.png','map2.png' | Set-Content $_.FullName
}