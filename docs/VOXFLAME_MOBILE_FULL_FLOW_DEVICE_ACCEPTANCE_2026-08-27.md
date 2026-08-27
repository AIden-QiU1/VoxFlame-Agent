# VoxFlame Mobile 完整替代 Web 真机验收

> 适用版本：`0.1.5 (6)` 起。Android 与 iPhone 必须分别执行；只打开页面、只跑模拟器或只完成 bundle 构建都不算通过。

## 自动化门

```bash
cd apps/mobile-workbench
npm run smoke:device-env
npm run test:communication
npm run test:training
npm run test:memory
npm run check
npm run typecheck
npm run export:android
npm run export:ios
```

Backend 同时运行 `cd backend && npm run build`，仓库根目录运行 `bash scripts/check_ai_docs.sh`。

## 每个平台必须完整走通的流程

1. 真实账号登录；退出登录后仍能进入快速表达。
2. 快速表达：短句本机朗读、自定义文字朗读、复制、大字展示；确认没有创建 RTC、没有上传声音。
3. 语音助手：连接 LiveKit、麦克风说话、接收确认文字、编辑文字并发送给 agent、结束连接。
4. 训练首页：马上录、自己的材料、8 个主题全部可见；现代文章朗读显示连续朗读。
5. 从系统文件选择器导入 `.txt/.md`，保存、切换材料，逐句清单与 Web/backend 一致。
6. 停止录音后先停在确认页；回听正常，确认收录后才上传并进入下一句。
7. 重录这一句：旧录音撤回成功后才开始新录音；撤回失败时不得开始。
8. 不收录：本机录音删除；已上传录音同时撤回云端资产，失败时保留可重试状态。
9. 场景模板启用/停用；系统模板的重点词和开口句可查看。
10. 自定义重点词新增、编辑、删除后，Web、App 和下一次 RTC workspace 保持一致。
11. 沟通画像、材料、常用短句分别完成新增/修改/删除或清空，并确认 Web 同源。
12. 录音中断网仍能停止并保留本机文件；恢复网络后上传成功，重复重试不产生重复 manifest。
13. Android/iPhone 各自验证麦克风拒绝、重新授权、蓝牙/有线输入断开后的安全回退。

## 证据格式与判定

复制 `apps/mobile-workbench/device-acceptance.example.json`，分别保存为 Android 和 iOS 结果。不得写真实姓名、完整手机号、表达正文或音频地址。每项必须有非空证据，`fail` 不能通过，`conditional` 必须写明问题。

```bash
cd apps/mobile-workbench
npm run validate:device-acceptance -- android-result.json
npm run validate:device-acceptance -- ios-result.json
```

只有两条命令都退出码为 0，才可宣称 App 已通过 Android/iPhone 完整替代 Web 的真机验收。缺实体设备、Apple 签名或真实账号时，平台状态必须是 `pending`。
