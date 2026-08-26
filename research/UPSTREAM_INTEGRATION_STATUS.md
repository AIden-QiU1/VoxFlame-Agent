# CLEAR-VOX-MODEL 接入状态

> 检查日期：2026-08-14

## 主 submodule

- 路径：`references/clear-vox-model`
- URL：`git@github.com:voxflame/CLEAR-VOX-MODEL.git`
- 固定 commit：`0997c0dc941ad0cda39e3ab92d5efd783fbfc38f`
- 默认分支：`main`
- 当前主仓库工作树、研究文档、R&D/EXP、harness、runtime 和 Git 跟踪资产均已 checkout。

## 嵌套 submodule

已能按上游固定 gitlink checkout：

- `external/film-spk-asr`
- `external/wespeaker`
- `modules/dsr/Codec-DSR`
- `modules/dsr/Mega-ASR`
- `modules/dsr/PHOENIXDSR`
- `modules/vc/meanFlow`

已知上游阻塞：

- `modules/dsr/Qwen3-ASR` 的 gitlink 指向 `8ea124934503caafef144b3aeb3038812c72004a`。
- 其配置远程 `https://github.com/chen-ming-yang/Qwen3-ASR.git` 当前返回 `not our ref`，无法获取该 commit。
- 本地不擅自替换为远端最新 main，因为这会破坏上游实验版本可复现性。
- 该阻塞不影响 `modules/dsr/R&D/Qwen3-ASR/` 中已纳入主仓库的研究、分析与 EXP 记录。

另一个递归元数据缺口：

- `modules/dsr/Codec-DSR` 本身已按 gitlink `3d6afc3...` 完整 checkout。
- 其 Git tree 里还包含 `Matcha-TTS` gitlink `bd4d90d...`，但该仓库没有提交 `.gitmodules` 映射。
- 因此从主仓库运行 `git submodule status --recursive` 会在进入 `Codec-DSR` 后报告 `no submodule mapping found in .gitmodules for path 'Matcha-TTS'`。
- 修复需要在 `Codec-DSR` 上游补充 `Matcha-TTS` 的准确 URL 与 `.gitmodules`；当前应用仓库不能可靠猜测该依赖来源。

正确修复位置是 `CLEAR-VOX-MODEL` 上游：恢复目标 commit，或在确认实验兼容性后更新其 gitlink。修复前，递归初始化会在此路径报告失败。

## 初始化

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

如递归命令在上述 `Qwen3-ASR` 或 `Codec-DSR/Matcha-TTS` 路径失败，先查本状态文档；不要自动 checkout 其他 commit 或猜测远程 URL 冒充成功。
