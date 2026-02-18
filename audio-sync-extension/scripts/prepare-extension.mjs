import { cp, copyFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const target = (process.argv[2] || 'chrome').toLowerCase()
if (!['chrome', 'firefox'].includes(target)) {
  console.error('Usage: node scripts/prepare-extension.mjs [chrome|firefox]')
  process.exit(1)
}

const distDir = path.join(projectRoot, 'dist')
const extensionDir = path.join(projectRoot, 'extension')
const iconsSrc = path.join(extensionDir, 'icons')
const iconsDest = path.join(distDir, 'icons')
const manifestSrc =
  target === 'firefox'
    ? path.join(extensionDir, 'manifest-firefox.json')
    : path.join(extensionDir, 'manifest.json')
const manifestDest = path.join(distDir, 'manifest.json')

await mkdir(distDir, { recursive: true })
await rm(iconsDest, { recursive: true, force: true })
await cp(iconsSrc, iconsDest, { recursive: true })
await copyFile(manifestSrc, manifestDest)

console.log(`Prepared extension dist for ${target}: ${distDir}`)
