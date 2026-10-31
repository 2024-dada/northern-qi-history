param(
  [string]$Version = ((Get-Date -Format 'yyyyMMdd') + 'a')
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$cssOrder = @('styles.css', 'animation.css', 'violence.css', 'dossier.css', 'theme.css', 'ai-help.css', 'music.css')
$jsOrder = @('data.js', 'violence.js', 'dossier.js', 'app.js', 'animation.js', 'theme.js', 'ai-help.js', 'music.js')

$css = foreach ($file in $cssOrder) {
  "/* ===== $file ===== */"
  [IO.File]::ReadAllText((Join-Path $root $file), [Text.Encoding]::UTF8)
}
[IO.File]::WriteAllText((Join-Path $root 'bundle.css'), ($css -join "`n"), [Text.UTF8Encoding]::new($false))

$js = foreach ($file in $jsOrder) {
  "/* ===== $file ===== */"
  [IO.File]::ReadAllText((Join-Path $root $file), [Text.Encoding]::UTF8)
}
[IO.File]::WriteAllText((Join-Path $root 'bundle.js'), ($js -join ";`n"), [Text.UTF8Encoding]::new($false))

$htmlPath = Join-Path $root 'index.html'
$html = [IO.File]::ReadAllText($htmlPath, [Text.Encoding]::UTF8)
$html = [regex]::Replace($html, '<link rel="stylesheet" href="(?:styles|animation|violence|dossier|theme|ai-help|music|bundle)\.css(?:\?[^\"]*)?"[ \t]*/?>', '')
$html = [regex]::Replace($html, '<script src="(?:data|violence|dossier|app|animation|theme|ai-help|music|bundle)\.js(?:\?[^\"]*)?"(?: defer)?></script>', '')

$bootstrap = @'
<script data-theme-bootstrap>
(()=>{'use strict';const ids=['paper','jade','blue','night'];let selected='paper';try{const saved=localStorage.getItem('qi-ui-theme');if(ids.includes(saved))selected=saved;}catch{}document.documentElement.dataset.uiTheme=selected;})();
</script>
'@
$bootstrapPattern = '(?s)<script data-theme-bootstrap>.*?</script>[ \t]*\r?\n?'
if ([regex]::IsMatch($html, $bootstrapPattern)) {
  $html = [regex]::Replace($html, $bootstrapPattern, $bootstrap)
} else {
  $html = [regex]::new('(?m)^(  <title>.*</title>)[ \t]*\r?$').Replace($html, ('$1' + "`n" + $bootstrap.TrimEnd() + "`n"), 1)
}

$resources = "<link rel=`"stylesheet`" href=`"bundle.css?v=$Version`">`n<script src=`"bundle.js?v=$Version`" defer></script>`n"
$html = [regex]::Replace($html, '(?s)<head>.*?</head>', {
  param($match)
  $head = [regex]::Replace($match.Value, '(?:\r?\n[ \t]*){2,}', "`n")
  $head.Replace('</head>', "$resources</head>")
})
[IO.File]::WriteAllText($htmlPath, $html, [Text.UTF8Encoding]::new($false))

"构建完成：bundle.css / bundle.js，版本 $Version"
