param(
  [string]$Version = ((Get-Date -Format 'yyyyMMdd') + 'a')
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$cssOrder = @('styles.css', 'animation.css', 'violence.css', 'dossier.css', 'theme.css', 'ai-help.css', 'music.css', 'sidebar.css', 'surfaces.css', 'survival-portal.css')
$jsOrder = @('data.js', 'violence.js', 'dossier.js', 'app.js', 'animation.js', 'theme.js', 'ai-help.js', 'music.js', 'sidebar.js')

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
(()=>{'use strict';const ids=['mural','paper','jade','blue','night'];let selected='mural';try{const saved=localStorage.getItem('qi-ui-theme');if(ids.includes(saved))selected=saved;}catch{}document.documentElement.dataset.uiTheme=selected;})();
</script>
'@
$bootstrapPattern = '(?s)<script data-theme-bootstrap>.*?</script>[ \t]*\r?\n?'
if ([regex]::IsMatch($html, $bootstrapPattern)) {
  $html = [regex]::Replace($html, $bootstrapPattern, $bootstrap)
} else {
  $html = [regex]::new('(?m)^(  <title>.*</title>)[ \t]*\r?$').Replace($html, ('$1' + "`n" + $bootstrap.TrimEnd() + "`n"), 1)
}

$resources = "<link rel=`"stylesheet`" href=`"bundle.css?v=$Version`">`n<script src=`"bundle.js?v=$Version`" defer></script>`n"
$html = $html.Replace('</head>', "$resources</head>")
$html = [regex]::Replace($html, '(survival\.html\?v=)[^"#]+', ('${1}' + $Version))
[IO.File]::WriteAllText($htmlPath, $html, [Text.UTF8Encoding]::new($false))

$survivalHtmlPath = Join-Path $root 'survival.html'
$survivalHtml = [IO.File]::ReadAllText($survivalHtmlPath, [Text.Encoding]::UTF8)
$survivalHtml = [regex]::Replace($survivalHtml, '(survival(?:\.css|-game-data\.js|-engine\.js|\.js)\?v=)[^"#]+', ('${1}' + $Version))
[IO.File]::WriteAllText($survivalHtmlPath, $survivalHtml, [Text.UTF8Encoding]::new($false))

$survivalNode = Get-Command node -ErrorAction SilentlyContinue
if ($survivalNode) {
  & $survivalNode.Source (Join-Path $root 'tools/build-survival-data.mjs')
  if ($LASTEXITCODE -ne 0) { throw '游戏史料索引生成失败。' }
} elseif (-not (Test-Path (Join-Path $root 'survival-game-data.js'))) {
  throw '缺少游戏史料索引；请安装Node.js后运行tools/build-survival-data.mjs。'
} else {
  Write-Warning '未找到Node.js，沿用仓库中已生成的survival-game-data.js。'
}

"构建完成：bundle.css / bundle.js 与 survival-game-data.js，版本 $Version"
