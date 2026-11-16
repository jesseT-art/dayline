import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const icon = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="70" y1="34" x2="455" y2="485" gradientUnits="userSpaceOnUse">
      <stop stop-color="#22D7C1"/>
      <stop offset=".46" stop-color="#3388F6"/>
      <stop offset="1" stop-color="#765CF5"/>
    </linearGradient>
    <radialGradient id="shine" cx="0" cy="0" r="1" gradientTransform="translate(112 70) rotate(43) scale(360)">
      <stop stop-color="white" stop-opacity=".42"/>
      <stop offset=".56" stop-color="white" stop-opacity=".08"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="edge" x1="102" y1="416" x2="402" y2="484" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1559D8" stop-opacity="0"/>
      <stop offset="1" stop-color="#4327B8" stop-opacity=".34"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="116" fill="url(#bg)"/>
  <rect width="512" height="512" rx="116" fill="url(#shine)"/>
  <rect width="512" height="512" rx="116" fill="url(#edge)"/>
  <path d="M145 158h202M145 256h123M145 354h72" stroke="white" stroke-width="34" stroke-linecap="round"/>
  <path d="m267 352 41 41 69-91" fill="none" stroke="white" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`)

const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="54" y1="20" x2="468" y2="500" gradientUnits="userSpaceOnUse">
      <stop stop-color="#22D7C1"/>
      <stop offset=".46" stop-color="#3388F6"/>
      <stop offset="1" stop-color="#765CF5"/>
    </linearGradient>
    <radialGradient id="shine" cx="0" cy="0" r="1" gradientTransform="translate(108 58) rotate(43) scale(360)">
      <stop stop-color="white" stop-opacity=".38"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#shine)"/>
  <path d="M170 184h172M170 256h101M170 328h58" stroke="white" stroke-width="29" stroke-linecap="round"/>
  <path d="m272 326 34 34 57-75" fill="none" stroke="white" stroke-width="29" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`)

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
await mkdir(publicDir, { recursive: true })
await Promise.all([
  sharp(icon).resize(192, 192).png().toFile(resolve(publicDir, 'pwa-192x192.png')),
  sharp(icon).resize(512, 512).png().toFile(resolve(publicDir, 'pwa-512x512.png')),
  sharp(icon).resize(180, 180).png().toFile(resolve(publicDir, 'apple-touch-icon.png')),
  sharp(maskable).resize(512, 512).png().toFile(resolve(publicDir, 'pwa-maskable-512x512.png'))
])
