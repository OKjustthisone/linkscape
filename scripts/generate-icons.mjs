// 从已生成的 Linkscape 图形源文件派生 Chrome 所需的多尺寸图标。
// macOS 的 sips 可以保留透明通道，避免重新运行脚本时覆盖品牌图形。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(root, '..', 'public', 'icons')
const source = path.join(outDir, 'linkscape-mark.png')

mkdirSync(outDir, { recursive: true })

if (!existsSync(source)) {
  console.error(`[icons] missing source: ${source}`)
  process.exit(1)
}

for (const size of [16, 32, 48, 128]) {
  const target = path.join(outDir, `icon${size}.png`)
  execFileSync('sips', ['-z', String(size), String(size), source, '--out', target], {
    stdio: 'ignore',
  })
  console.log(`[icons] ${target}`)
}
