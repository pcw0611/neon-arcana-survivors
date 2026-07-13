import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const publicDir = path.join(projectDir, 'public');
const outputDir = path.resolve(
  projectDir,
  '..',
  'outputs',
  'NeonArcanaEndlessLocalTest',
);
const outputFile = path.join(outputDir, 'NeonArcanaEndlessLocalTest.html');

const htmlFile = path.join(publicDir, 'game.html');
const gameScriptFile = path.join(publicDir, 'game-v4.js');
const legacyScriptPattern =
  /<script\b[^>]*\btype=["']text\/plain["'][^>]*\bid=["']legacy-game["'][^>]*>[\s\S]*?<\/script>\s*/i;
const externalGameScriptPattern =
  /<script\b[^>]*\bsrc=["'](?:\.\/)?game-v4\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/i;
const pngAssetPattern = /assets\/([A-Za-z0-9._-]+\.png)\b/g;

function assertSingleMatch(source, pattern, label) {
  const first = source.match(pattern);
  if (!first) {
    throw new Error(`${label}을(를) 찾지 못했습니다.`);
  }

  const withoutFirst = source.replace(pattern, '');
  if (pattern.test(withoutFirst)) {
    throw new Error(`${label}이(가) 두 번 이상 존재합니다.`);
  }
}

async function buildOfflineHtml() {
  const [sourceHtml, sourceGameScript] = await Promise.all([
    readFile(htmlFile, 'utf8'),
    readFile(gameScriptFile, 'utf8'),
  ]);

  assertSingleMatch(sourceHtml, legacyScriptPattern, 'legacy-game 스크립트 블록');
  assertSingleMatch(sourceHtml, externalGameScriptPattern, 'game-v4.js 스크립트 태그');

  let html = sourceHtml.replace(legacyScriptPattern, '');
  let gameScript = sourceGameScript;

  const referencedAssets = new Set();
  for (const source of [html, gameScript]) {
    for (const match of source.matchAll(pngAssetPattern)) {
      referencedAssets.add(match[1]);
    }
  }

  if (referencedAssets.size === 0) {
    throw new Error('포함할 PNG 에셋 참조를 찾지 못했습니다.');
  }

  for (const assetName of [...referencedAssets].sort()) {
    const assetPath = path.join(publicDir, 'assets', assetName);
    const dataUrl = `data:image/png;base64,${(await readFile(assetPath)).toString('base64')}`;
    const publicReference = `assets/${assetName}`;
    html = html.split(publicReference).join(dataUrl);
    gameScript = gameScript.split(publicReference).join(dataUrl);
  }

  // A literal closing script tag inside JavaScript would terminate the inline
  // element early when the standalone file is parsed as HTML.
  gameScript = gameScript.replace(/<\/script/gi, '<\\/script');
  html = html.replace(
    externalGameScriptPattern,
    `<script>\n${gameScript}\n</script>`,
  );

  if (legacyScriptPattern.test(html)) {
    throw new Error('legacy-game 스크립트 블록 제거에 실패했습니다.');
  }
  if (externalGameScriptPattern.test(html)) {
    throw new Error('game-v4.js 인라인 처리에 실패했습니다.');
  }
  if (/\bassets\/[A-Za-z0-9._-]+\.png\b/.test(html)) {
    throw new Error('일부 PNG 에셋 참조가 외부 경로로 남아 있습니다.');
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, html, 'utf8');

  return {
    outputFile,
    assetCount: referencedAssets.size,
    byteLength: Buffer.byteLength(html),
  };
}

const result = await buildOfflineHtml();
console.log(`Standalone HTML: ${result.outputFile}`);
console.log(`Embedded PNG assets: ${result.assetCount}`);
console.log(`Output bytes: ${result.byteLength}`);
