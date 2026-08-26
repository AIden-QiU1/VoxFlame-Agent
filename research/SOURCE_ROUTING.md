# 研究来源路由与更新规范

## 目标

让研究可以持续发现和更新，而不是维护一组静态书签。来源注册表在 [`SOURCE_REGISTRY.yaml`](SOURCE_REGISTRY.yaml)；本文件定义如何搜索、抓取、核验和回流。默认白名单已经收窄为每个主题 3 个锚点，雷达来源只做按需发现。

## 来源等级

| 等级 | 典型来源 | 可支撑的结论 |
| --- | --- | --- |
| `primary` | 标准组织、政府机构、官方文档、原始论文/数据、官方代码 | 规范、接口、实验结果和明确的政策/临床边界 |
| `professional` | 专业学会、大学/医院、公共卫生机构、专业数据库 | 专业实践、术语、用户与临床背景；高风险结论尽量再找一手来源 |
| `industry` | 产品官网、厂商博客、行业报告 | 产品形态和工程实践的发现与对照，不单独支撑医疗/安全事实 |
| `exploratory` | 社区、个人网站、聚合站、搜索结果 | 只用于发现关键词、项目和候选来源，必须回溯验证 |
| `expert_social` | 可核验身份的学者、临床专家、工程师及其博客、Newsletter、播客、YouTube、X/LinkedIn/Bilibili/知乎账号 | 实时发现、争议追踪和实践线索；必须绑定身份与一手证据，不能单独支撑高风险结论 |

## 按问题路由

- `voice-agent`：LiveKit/WebRTC 官方文档 -> W3C/MDN -> 官方代码与 release -> 论文；实时语音结论还要回到真实沟通 smoke。
- `agent-systems`：NIST/W3C/OWASP 等标准 -> 原始论文/官方实现 -> 高质量工程文章；框架宣传不能替代系统证据。
- `speech-health`：政府/专业机构（NIDCD、WHO、ASHA）和 PubMed/Europe PMC -> 大学/医院 -> `speechhome.com` 等领域站点。领域站点适合发现材料，不自动获得临床权威等级。
- `product-psychology`：W3C COGA/WCAG、WHO ICF、专业沟通研究 -> 目标用户访谈/可用性观察 -> 产品案例。案例只能说明设计选择，不证明普遍效果。
- `product-engineering`：官方协议/云服务文档 -> W3C/NIST/OWASP -> 官方仓库与 release -> 工程实践文章。

## 学者、专家和社媒来源

社媒不是“低质量来源”的同义词，但必须做身份与证据绑定。建议按以下顺序建立专家卡片：

1. `identity`：姓名、专业领域、机构/公司、国家或语言、个人主页。
2. `authority_links`：机构主页、ORCID、Google Scholar、PubMed 作者页、官方项目仓库或临床执业/学会页面，至少一项；高风险主题建议两项。
3. `channels`：博客、Newsletter、播客、YouTube、X、LinkedIn、Bilibili、知乎等平台 URL；记录是否本人账号、是否有明确署名。
4. `scope`：只把作者在其专业范围内的内容纳入；跨界观点标为 `opinion`，不自动升级证据等级。
5. `evidence_link`：每条重要观点都回溯论文、标准、官方文档、代码、数据或可复现演示；找不到回溯证据就保留为线索。
6. `conflict_and_date`：记录商业关系、赞助、发布日期、最后编辑时间和内容是否已被修订。

### 中外平台路由

- 英文：个人主页/大学主页 -> ORCID、Google Scholar、PubMed、GitHub -> Newsletter/博客 -> X、LinkedIn、YouTube、Podcast。
- 中文：大学/医院/学会主页 -> CNKI、国家卫健委/中国残联等公开机构、论文原文 -> 公众号、知乎、Bilibili、微博、小红书。
- 平台搜索只做发现，不直接作为最终引用；同一专家的多个平台账号应合并为一张专家卡片，避免重复计权。
- 中文社媒转载内容要追踪原始作者和原文链接，特别注意营销号、AI 摘要和二次剪辑。

### 专家来源的更新优先级

| 事件 | 动作 |
| --- | --- |
| 新论文、标准、官方 release | 进入高优先级待审队列 |
| 专家发布观点/演讲/播客 | 记录摘要和原始链接，等待证据回溯 |
| 观点与已有证据冲突 | 建立对照条目，不覆盖原结论 |
| 账号身份无法确认、长期不更新或内容大量营销 | 降级为 `exploratory` 或暂停抓取 |

## 实时搜索、抓取和更新

1. 把问题拆成主题、证据类型、时间范围和用户场景；先查本地研究与回流登记。
2. 从注册表中选择最高等级、最高相关度的来源；使用搜索只做 URL 发现，打开原始页面后再引用。
3. 抓取前检查 robots.txt、服务条款、公开许可、登录/验证码要求和频率限制；禁止绕过访问控制。
4. 优先使用 RSS、Atom、官方 API、sitemap 和 release feed；没有结构化入口才抓公开 HTML。
5. 保存最小必要快照元数据：`source_id / url / fetched_at / status / etag / last_modified / content_hash / title / published_at`。原文快照应放在被 `.gitignore` 的临时或外部归档目录，不把大段网页复制进研究稿。
6. 用 `refresh` 周期做增量检查；内容 hash 未变化时不产生新研究条目，发生变化时进入待审队列。
7. 访问失败必须记录原因并使用注册表中的 fallback；fallback 的证据等级和不确定性要在研究笔记中显式说明。
8. 只有完成来源核验、证据提取、限制记录和 VoxFlame 映射后，才能更新研究综合或 `APPLICATION_FEEDBACK_REGISTRY.md`。

## `speechhome.com` 的使用边界

它可以作为构音障碍/语音沟通领域的高相关发现入口，帮助寻找术语、实践材料、产品和社区线索。但在确认站点可访问性、作者/编辑资质、引用链、更新时间和内容许可前，默认标记为 `candidate_unverified` / `exploratory`，不能单独支撑医疗结论、模型部署或用户承诺。

同理，相关学者/博主的社媒适合做“雷达层”：发现最新研究、争议和真实实践，再回到论文、机构、标准或官方实现做“证据层”核验。没有证据回溯的内容不进入默认来源白名单。

## 最小来源记录

```yaml
source_id: speechhome
checked_at: 2026-08-14
status: candidate_unverified
evidence_level: exploratory
access: dns_failed
fallback_used: nidcd
next_check: 2026-08-21
```
