import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MANDARIN_READING_ARTICLES,
  validateReadingArticles,
} from './reading-articles'

test('original reading pack has 60 coherent, versioned articles', () => {
  assert.equal(MANDARIN_READING_ARTICLES.length, 60)
  assert.deepEqual(validateReadingArticles(MANDARIN_READING_ARTICLES), [])
  assert.ok(MANDARIN_READING_ARTICLES.every((article) => (
    article.source.kind === 'voxflame_original'
    && article.source.label.includes('燃言原创')
    && article.fullText.length > 200
    && article.segments.length >= 15
    && article.segments.every((segment) => segment.chineseCharacterCount >= 6 && segment.chineseCharacterCount <= 16)
  )))
})
