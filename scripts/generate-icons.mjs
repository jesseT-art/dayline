import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const icon = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="116" fill="#171714"/>
  <path d="M142 166h228M142 256h156M142 346h184" stroke="#F8F5EC" stroke-width="42" stroke-linecap="round"/>
  <circle cx="362" cy="346" r="46" fill="#F0A259"/>
</svg>`)

const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#171714"/>
  <path d="M162 182h188M162 256h130M162 330h154" stroke="#F8F5EC" stroke-width="34" stroke-linecap="round"/>
  <circle cx="344" cy="330" r="36" fill="#F0A259"/>
</svg>`)

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
await mkdir(publicDir, { recursive: true })
await Promise.all([
  sharp(icon).resize(192, 192).png().toFile(resolve(publicDir, 'pwa-192x192.png')),
  sharp(icon).resize(512, 512).png().toFile(resolve(publicDir, 'pwa-512x512.png')),
  sharp(icon).resize(180, 180).png().toFile(resolve(publicDir, 'apple-touch-icon.png')),
  sharp(maskable).resize(512, 512).png().toFile(resolve(publicDir, 'pwa-maskable-512x512.png'))
])
