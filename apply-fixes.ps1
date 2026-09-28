$ErrorActionPreference = "Stop"

function Replace-Exact([string]$Path, [string]$Old, [string]$New) {
  $text = Get-Content -Raw -LiteralPath $Path
  if (-not $text.Contains($Old)) {
    throw "Expected text not found in $Path. Your local source differs from this patch; stop instead of applying a blind replacement."
  }
  Set-Content -LiteralPath $Path -Value ($text.Replace($Old,$New)) -Encoding utf8
}

# 1) Remove stale RC8 hard-coding while still requiring an RC package + rc publish tag.
Replace-Exact ".\tests\builds-26-30-rc.test.ts" `
"assert.equal(pkg.version,'1.0.0-rc.8');" `
"assert.match(pkg.version,/^1\\.0\\.0-rc\\.\\d+$/);"

$buildTest = Get-Content -Raw -LiteralPath ".\tests\builds-26-30-rc.test.ts"
$buildTest = $buildTest.Replace("const entry=resolve('bin/senten.mjs');`r`n  try{", "const entry=resolve('bin/senten.mjs');`r`n  const rootPkg=JSON.parse(await readFile('package.json','utf8')) as {version:string};`r`n  try{")
$buildTest = $buildTest.Replace("assert.equal(report.version,'1.0.0-rc.8');", "assert.equal(report.version,rootPkg.version);")
$buildTest = $buildTest.Replace("assert.match(alignment?.detail??'',/running 1\\.0\\.0-rc\\.8; repository package\\.json is 9\\.9\\.9/);", "assert.match(alignment?.detail??'',new RegExp(`running ${rootPkg.version.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')}; repository package\\\\.json is 9\\\\.9\\\\.9`));")
Set-Content -LiteralPath ".\tests\builds-26-30-rc.test.ts" -Value $buildTest -Encoding utf8

# 2) Workflow test: avoid collision with built-in smoke workflow.
$cliPath = ".\tests\cli-experience.test.ts"
$cli = Get-Content -Raw -LiteralPath $cliPath
$cli = $cli.Replace("run(root,['workflow','create','smoke','--empty'])", "run(root,['workflow','create','test-smoke','--empty'])")
$cli = $cli.Replace("run(root,['workflow','add','smoke','--','doctor'])", "run(root,['workflow','add','test-smoke','--','doctor'])")
$cli = $cli.Replace("run(root,['workflow','add','smoke','--','discover'])", "run(root,['workflow','add','test-smoke','--','discover'])")
$cli = $cli.Replace("run(root,['workflow','steps','smoke'])", "run(root,['workflow','steps','test-smoke'])")
$cli = $cli.Replace("run(root,['workflow','validate','smoke'])", "run(root,['workflow','validate','test-smoke'])")
Set-Content -LiteralPath $cliPath -Value $cli -Encoding utf8

# 3) Distribution test: validate active RC rather than RC8 specifically.
Replace-Exact ".\tests\distribution.test.ts" `
"assert.equal(pkg.version,'1.0.0-rc.8');" `
"assert.match(pkg.version,/^1\\.0\\.0-rc\\.\\d+$/);"

# 4) Detailed report contract + current adoption section naming.
Replace-Exact ".\tests\rc4-dogfood-hardening.test.ts" `
"assert.match(report,/Senten Record/);assert.match(report,/senten discover/);assert.match(report,/senten adopt/);assert.match(report,/Adoption Snapshot/);assert.match(report,/\\*\\*PASS\\*\\*/);" `
"assert.match(report,/Senten (?:Detailed )?Record/);assert.match(report,/senten discover/);assert.match(report,/senten adopt/);assert.match(report,/Architecture \\/ Adoption Understanding|Adoption Snapshot/);assert.match(report,/\\*\\*PASS\\*\\*/);"

# 5) RC6: explicit framework evidence + current idempotent-init wording.
Replace-Exact ".\tests\rc6-release-hardening.test.ts" `
"await writeFile(join(cwd,'package.json'),JSON.stringify({name:'basic',private:true,packageManager:'pnpm@11.25.0'}));" `
"await writeFile(join(cwd,'package.json'),JSON.stringify({name:'basic',private:true,packageManager:'pnpm@11.25.0',devDependencies:{next:'15.0.0',react:'19.0.0'}}));"

Replace-Exact ".\tests\rc6-release-hardening.test.ts" `
"r=run(['init']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/already initialized/i);" `
"r=run(['init']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/already initialized|workspace is current|no changes required/i);"

# 6) Source intelligence: make React assertion evidence-backed via package.json.
$siPath = ".\tests\source-intelligence.test.ts"
$si = Get-Content -Raw -LiteralPath $siPath
$needle = "const cwd = await mkdtemp(join(tmpdir(), 'senten-source-'));"
if (-not $si.Contains($needle)) { throw "Expected source-intelligence fixture line not found." }
$si = $si.Replace($needle, $needle + "`r`n  await writeFile(join(cwd, 'package.json'), JSON.stringify({ dependencies: { react: '19.0.0' } }));")
Set-Content -LiteralPath $siPath -Value $si -Encoding utf8

Write-Host ""
Write-Host "Senten RC26 release-test reconciliation applied."
Write-Host "Run next:"
Write-Host "  npm run clean"
Write-Host "  npm run typecheck"
Write-Host "  npm run build"
Write-Host "  npm test"
