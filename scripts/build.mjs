// Linkscape 构建脚本
// 一次构建分两轮：
//   1) 内容脚本 -> 单个 IIFE 文件 assets/content.js（Shadow DOM 面板 + 边缘触发）
//   2) 页面 (manager/options/popup) + Service Worker -> ES Module 资产
// public/ 下的 manifest.json 与 icons 直接拷贝进临时构建目录，
// 构建完成后再提升到 Linkscape 根目录，根目录即可直接加载到 Chrome。
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stagingDir = path.join(root, '.build')

const watch = process.argv.includes('--watch')

rmSync(stagingDir, { recursive: true, force: true })
cpSync(path.join(root, 'public'), stagingDir, { recursive: true })

const common = {
  configFile: false,
  root,
  base: './',
  plugins: [react()],
  define: { __DEV__: JSON.stringify(false) },
  build: {
    outDir: stagingDir,
    emptyOutDir: false,
    target: 'chrome110',
    sourcemap: false,
    minify: true,
    watch: watch ? {} : null,
    rollupOptions: {},
  },
}

// ---- 第 1 轮：内容脚本（IIFE，单文件，内联所有依赖） ----
await build({
  ...common,
  build: {
    ...common.build,
    rollupOptions: {
      input: path.join(root, 'src/content/content.ts'),
      output: {
        entryFileNames: 'assets/content.js',
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
})

// ---- 第 2 轮：页面 + Service Worker（ES Module） ----
await build({
  ...common,
  build: {
    ...common.build,
    rollupOptions: {
      input: {
        background: path.join(root, 'src/background/service-worker.ts'),
        manager: path.join(root, 'src/entries/manager.html'),
        options: path.join(root, 'src/entries/options.html'),
        popup: path.join(root, 'src/entries/popup.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        format: 'es',
      },
    },
  },
})

const runtimeEntries = [
  ['assets', 'assets'],
  ['icons', 'icons'],
  ['manifest.json', 'manifest.json'],
  ['src/entries/manager.html', 'manager.html'],
  ['src/entries/options.html', 'options.html'],
  ['src/entries/popup.html', 'popup.html'],
]

for (const [source, target] of runtimeEntries) {
  const sourcePath = path.join(stagingDir, source)
  const targetPath = path.join(root, target)
  rmSync(targetPath, { recursive: true, force: true })
  if (target.endsWith('.html')) {
    const html = readFileSync(sourcePath, 'utf8').replaceAll('../../assets/', './assets/')
    writeFileSync(targetPath, html)
  } else {
    cpSync(sourcePath, targetPath, { recursive: true })
  }
}

rmSync(stagingDir, { recursive: true, force: true })
console.log('[linkscape] 构建完成 -> Linkscape 根目录（可直接加载）')
