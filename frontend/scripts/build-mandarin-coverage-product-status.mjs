#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { buildCoverageProductStatus } from './mandarin-coverage-product-status-core.mjs'

function value(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const ledgerPath = value('--ledger')
const reviewPath = value('--review')
const approvedPath = value('--approved')
const reinforcementPath = value('--reinforcement')
const collectionEvidencePath = value('--collection-evidence')
const outputPath = value('--output')
if (!ledgerPath || !reviewPath || !approvedPath || !reinforcementPath || !outputPath) {
  throw new Error('usage: build-mandarin-coverage-product-status --ledger <ledger.json> --review <phase1.json> --approved <approved.json> --reinforcement <plan.json> --output <status.json>')
}

const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'))
const approved = JSON.parse(fs.readFileSync(approvedPath, 'utf8'))
const reinforcement = JSON.parse(fs.readFileSync(reinforcementPath, 'utf8'))
const collectionEvidence = collectionEvidencePath
  ? JSON.parse(fs.readFileSync(collectionEvidencePath, 'utf8'))
  : null
const payload = buildCoverageProductStatus({ ledger, review, approved, reinforcement, collectionEvidence })

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote coverage product status: ${payload.core_gap_phase1.approved_prompts} approved prompts`)
