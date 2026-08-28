import assert from 'node:assert/strict'
import test from 'node:test'

import { MANDARIN_READING_ARTICLES } from './reading-articles'
import {
  getReadingArticleCycle,
  getReadingArticleProgress,
  rankReadingArticles,
} from './reading-progress'

test('article progress identifies recorded segments and next unrecorded segment', () => {
  const article = MANDARIN_READING_ARTICLES[0]
  const progress = getReadingArticleProgress(article, [article.segments[0].id, article.segments[2].id])
  assert.equal(progress.recordedCount, 2)
  assert.equal(progress.nextSegmentId, article.segments[1].id)
  assert.equal(progress.isComplete, false)
})

test('reset cycle restores global progress from the latest cloud-backed round', () => {
  const article = MANDARIN_READING_ARTICLES[0]
  const cycle = getReadingArticleCycle(
    article,
    article.segments.map((segment) => segment.id),
    [
      `round-1:${article.segments[0].id}`,
      `round-1:${article.segments[1].id}`,
    ],
  )

  assert.equal(cycle.roundId, 'round-1')
  assert.deepEqual(cycle.recordedSegmentIds, [article.segments[0].id, article.segments[1].id])
  assert.equal(cycle.nextRoundId, 'round-2')
})

test('ranking puts the least recorded incomplete article first and completed article last', () => {
  const first = MANDARIN_READING_ARTICLES[0]
  const second = MANDARIN_READING_ARTICLES[1]
  const recorded = [
    ...first.segments.map((segment) => segment.id),
    second.segments[0].id,
  ]
  const ranked = rankReadingArticles([first, second, MANDARIN_READING_ARTICLES[2]], recorded)
  assert.equal(ranked[0].article.id, MANDARIN_READING_ARTICLES[2].id)
  assert.equal(ranked[1].article.id, second.id)
  assert.equal(ranked[2].article.id, first.id)
})
