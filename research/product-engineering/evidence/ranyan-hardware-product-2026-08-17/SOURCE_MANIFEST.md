# 燃言硬件产品方案内部来源清单

> 获取与复核日期：2026-08-17
>
> 用途：支撑两份对外产品文档的内部参数审计。对外 Word 不附参考资料章节；本清单不等于整机认证、产品有效性或量产规格冻结。

## 本轮新增并校验的原厂材料

| 文件 | 发布者与材料 | 实际格式 | SHA-256 | 可支持的事实 | 不能支持的结论 |
| --- | --- | --- | --- | --- | --- |
| `ESP32-S3-WROOM-1_Datasheet.pdf` | Espressif, ESP32-S3-WROOM-1/1U Datasheet，2026-03 获取版本 | PDF，53 页 | `27d71971da07c280c6068d08c74720d1a25b8f20cf8494dc1765bdd28d40d435` | N16R8 为 16MB Flash/8MB PSRAM；ESP32-S3 具备 full-speed USB 2.0 OTG | 燃言 UAC/HID 全双工稳定、功耗、整机兼容与量产表现 |
| `TI_TAS2563_Datasheet.pdf` | Texas Instruments, TAS2563 Datasheet Rev. D | PDF，117 页 | `9d3283f8025c316dc5c08cfcf2e9dd9445921e2b83f9f330aa7d79025a9fd109` | 带 DSP、I/V sense、扬声器保护的 boosted Class-D 功放；原厂功率有明确负载、供电和 THD+N 条件 | 燃言整机声压、可懂度、续航、温升或最终功放选型 |
| `Qualcomm_QCM6490_Product_Page.html` | Qualcomm, Dragonwing QCM6490 当前官方产品页 | HTML，9,032 bytes | `4aae0bb18df4655be41b63a9943b75cde5f19866fd42e7d94acc3f5b7150274b` | 平台面向需要 5G、蜂窝、Wi-Fi 等连接与计算能力的 IoT/企业产品 | 固定内存、存储、BSP 支持期、模组价格、功耗或燃言整机性能 |
| `Rockchip_RK3566_Product_Page.html` | Rockchip, RK3566 当前官方产品页 | HTML，23,048 bytes | `4f2b0c94a61d3f3886a4706f7a99d84452c6a43397141b0395366e8055eafb10` | 型号存在及其公开 NPU/媒体平台能力 | 4GB/64GB、蜂窝、Android 补丁周期、整机功耗和沟通任务效果 |
| `Rockchip_RK3588_Product_Page.html` | Rockchip, RK3588 当前官方产品页 | HTML，24,251 bytes | `b5ca75ad042e019b490b1627bd74996fe02a72a320a1d292db2accd549e0dd71` | Android/Linux、高速接口和公开 NPU/媒体平台能力 | RK3588S 的完整差异、8GB/128GB 配置、持续热性能和本地模型效果 |
| `Tobii_Dynavox_TD_I-Series_Product_Page.html` | Tobii Dynavox, TD I-Series 当前官方产品页 | HTML，206,015 bytes | `50e98f49a4e56ac60ff3329015db398f056c019ff23d5806b4ce99fb47e7f1a3` | 专用 AAC 设备存在 13/16 英寸眼动输入、其他 access methods、开关和安装板等成熟能力 | 燃言 G5 应采用的屏幕、算力、内存、眼动方案、适用人群或商业可行性 |
| `Smartbox_Grid_Pad_Product_Page.html` | Smartbox, Grid Pad 当前官方产品页 | HTML，186,110 bytes | `d0beaacabc821d36d63a79fb0e8a4b8505b2a5c2a1c8cc909f8cb0494af4061f` | 专业 AAC 产品覆盖 10/13/16 英寸，并支持触控、keyguard、开关、眼动和轮椅/支架安装等不同输入方式 | 燃言 G5 的 12GB/256GB 候选容量、最终尺寸、眼动效果或中国服务/支付路径 |

## 复用的已校验专业与监管方法材料

下列材料此前已实际下载并检查文件类型、标题/页数和 SHA-256。本轮只复用其方法边界，不在对外 Word 中列参考文献：

| 材料 | 本轮用途 | 边界 |
| --- | --- | --- |
| ASHA AAC Practice Portal、Participation Model、Dysarthria in Adults | 目标用户、沟通伙伴、feature matching、试用、采用/弃用和功能沟通 | 不证明燃言整机效果，不替代中文目标用户研究 |
| FDA Human Factors Guidance、Home-use Design Guidance | 用户、环境、关键任务、使用错误、形成性评估、家庭/公共环境、电源和维护 | 只作高质量工程方法参照，不声明 FDA 管辖或合规 |
| FDA Cybersecurity Guidance、NISTIR 8259A | 设备标识、配置、数据保护、接口、更新、组件和生命周期 | 不等于产品认证或已满足特定市场要求 |
| EU MDR consolidated text | intended purpose、全生命周期风险和技术文档方法 | 不等于燃言属于医疗器械或符合 MDR |
| W3C WCAG 2.2 target-size explanation | 数字界面可访问性方法 | 不直接规定实体按键尺寸，也不证明目标用户可操作 |

原副本及其哈希已迁入本目录的 `sources/`；旧证据目录已清理，文件类型与哈希经迁移后复核。

## 获取失败与处理

| 尝试 | 结果 | 处理 |
| --- | --- | --- |
| Intel Processor N100 ARK 当前页面 | 本环境证书链校验失败 | 不宣称已读取；N100 只保留为机构网关容量候选，以固定工作负载和供应商原厂资料冻结 |
| Infineon IM69D130 两个官方下载地址 | 一个地址证书校验失败，另一个出现自签名证书链 | 不绕过 TLS、不保存伪材料；麦克风 SNR/AOP 只作为采购门槛，要求供应商提交原厂 datasheet 与样品 |
| Lingraphica TouchTalk 产品页 | 当前尝试 URL 返回 HTTP 404 | 不引用为已读或现役规格；已有两家官方 AAC 产品页面足以证明相关产品形态存在，具体选型仍由目标用户和专业服务验证 |
| Qualcomm QCM6490 旧 product brief URL | HTTP 404 | 改用实际打开的当前 Qualcomm 官方产品页；完整 brief、BSP 与生命周期仍由供应商提交 |
| Rockchip RK3566 旧 `/1275.html` URL | HTTP 404 | 从 Rockchip 官方产品目录发现正确 `/1274.html` 并实际打开保存 |
| WHO、部分辅助技术报告与厂商产品 PDF | 既有记录中出现网页壳、403、网络不可达或不稳定返回 | 不引用为已读；产品方法由已校验 ASHA/FDA/NIST 等材料支撑，产品参数仍由原厂资料、报价和样机冻结 |

## 发布规则

1. 原厂资料只证明器件或平台在其条件下的能力，不证明整机性能。
2. RAM、存储、电池、重量、续航、声压、IP、跌落和延迟只要没有正式样机数据，就必须标为候选或目标。
3. 成本、工期、MOQ、BSP 支持和供货必须由至少两家同口径书面回复或实验室报价进入决策。
4. 监管和专业资料只支持方法与风险边界，不证明分类、认证、临床有效或“医疗级”。
