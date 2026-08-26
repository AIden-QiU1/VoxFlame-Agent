import assert from 'node:assert/strict';

import {
  buildPreparedExpressionDraft,
  buildPreparedExpressionPracticeLines,
  buildPreparedExpressionTemplateFromDraft,
} from './prepared-expression.service';

function normalizeForAssertion(value: string): string {
  return value.replace(/\s+/g, '');
}

const content = Array.from({ length: 14 }, (_, index) => (
  `第${index + 1}段材料，应该完整进入训练语料。`
)).join('\n');

const draft = buildPreparedExpressionDraft({
  id: 'all-content',
  title: '全量材料',
  content,
});
const template = buildPreparedExpressionTemplateFromDraft(draft);

assert.equal(template.sections.length, 14);
assert.equal(
  normalizeForAssertion(template.sections.map((section) => section.anchorLine).join('')),
  normalizeForAssertion(content),
);
assert.ok(template.sections.every((section) => section.anchorLine.endsWith('。')));
assert.ok(template.sections.every((section) => section.practiceLines.length >= 1));

const longUnpunctuatedDraft = buildPreparedExpressionDraft({
  id: 'long-unpunctuated',
  title: '无标点长句',
  content: '这是一个没有任何标点的超长训练材料需要被切成自然长度',
});
const longUnpunctuatedTemplate = buildPreparedExpressionTemplateFromDraft(longUnpunctuatedDraft);
assert.deepEqual(longUnpunctuatedTemplate.sections[0]?.practiceLines, [
  '这是一个没有任何标点的超长训练材料需要被',
  '切成自然长度',
]);

assert.deepEqual(
  buildPreparedExpressionPracticeLines('第一段材料需要完整切句，而且保持自然长度。\n第二段也要进入同一份录音清单。'),
  [
    { text: '第一段材料需要完整切句，而且保持自然长度。', paragraphIndex: 0 },
    { text: '第二段也要进入同一份录音清单。', paragraphIndex: 1 },
  ],
);

console.log('prepared-expression.service.test passed');
