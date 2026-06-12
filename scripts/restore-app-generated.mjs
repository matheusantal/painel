import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const partsDir = join(root, 'src', 'app.generated.parts')
const outputPath = join(root, 'src', 'app.generated.tsx')
const parts = [
  'app-generated.01.b64',
  'app-generated.02.b64',
  'app-generated.03.b64',
  'app-generated.04.b64',
  'app-generated.05.b64',
  'app-generated.06.b64',
  'app-generated.07.b64',
  'app-generated.08.b64',
  'app-generated.09.b64',
  'app-generated.10.b64',
  'app-generated.11.b64',
  'app-generated.12.b64',
  'app-generated.13.b64',
  'app-generated.14.b64',
  'app-generated.15.b64',
  'app-generated.16.b64',
]

const base64 = (await Promise.all(
  parts.map((part) => readFile(join(partsDir, part), 'utf8')),
)).join('').replace(/\s/g, '')

await mkdir(join(root, 'src'), { recursive: true })
await writeFile(outputPath, Buffer.from(base64, 'base64'))
