#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const inputPath = value('--input')
const outputPath = value('--output')
if (!inputPath || !outputPath) {
  throw new Error('usage: build-mandarin-spoken-text-review-workspace --input <queue.json> --output <workspace.json>')
}

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
if (payload.kind !== 'voxflame_mandarin_spoken_text_review_queue') throw new Error('unexpected spoken text queue kind')
const workspace = {
  ...payload,
  title: '真实录音复核',
  description: '人工填写实际说出内容并确认音频对应；未通过复核不会计入音系覆盖或训练。',
  workspace_id: 'spoken-text',
  review_scope: 'historical_recordings',
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8')
console.log(`wrote ${workspace.items.length} spoken text review items`)
