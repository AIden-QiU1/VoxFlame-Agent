#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const inputPath = value('--input')
const outputPath = value('--output')
if (!inputPath || !outputPath) throw new Error('usage: build-mandarin-dual-review-workspace --input <queue.json> --output <workspace.json>')
const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
if (payload.kind !== 'voxflame_mandarin_dual_spoken_text_review_queue') throw new Error('unexpected dual spoken text queue kind')
const workspace = {
  ...payload,
  title: '双人独立真实录音复核',
  description: 'A、B 两位审核者分别填写自己的实际转写；一致性与仲裁由离线工具判断，未通过音频完整性门不得计入覆盖。',
  workspace_id: 'dual-spoken-text',
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8')
console.log(`wrote ${workspace.items.length} dual spoken text review items`)
