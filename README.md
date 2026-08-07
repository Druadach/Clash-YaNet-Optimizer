# Clash-YaNet-Optimizer

面向 Clash Verge Rev、Mihomo Party 等 Mihomo 客户端的通用优化覆写脚本。

本项目基于 [dahaha-365/YaNet](https://github.com/dahaha-365/YaNet) 的
[`Mihomo/global_script.js`](https://github.com/dahaha-365/YaNet/blob/febda695a817297bacc63a37b0e0aa16d5cd00fe/Mihomo/global_script.js)
修改，基线提交为 `febda695a817297bacc63a37b0e0aa16d5cd00fe`。

## 主要优化

- 地区与全局自动测速，支持国家/地区代码识别和高倍率节点保护。
- 保留俄罗斯网站直连优先、俄罗斯节点优先的专用策略。
- 服务规则可独立启用，兼容旧版 `openai`、`mediaHMT`、`TK` 等参数。
- 保留机场节点原名，为脚本生成的代理和策略组分配唯一名称，避免同名和策略环。
- 默认保留客户端的 LAN、控制器、端口、密钥、外部 UI 和 TUN 设置。
- DNS/TUN 使用安全合并语义；关闭 DNS 时同步移除 TUN DNS 劫持。
- 远程控制端口直连规则默认关闭，可按需显式启用。
- 支持仅含 `proxy-providers` 的订阅，并过滤无效静态节点。

## 使用

将 [`clash-verge-rev-fixed.js`](./clash-verge-rev-fixed.js) 导入或粘贴到客户端的
JavaScript 覆写/扩展脚本中。也可以直接修改脚本顶部的 `defaultArgs` 设置默认行为。

常用参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `enable` | `true` | 总开关；关闭后原样返回配置 |
| `ruleSet` | `manual` | `manual`、`all` 或以分号/逗号分隔的服务 key |
| `regionSet` | `all` | 启用的地区代码，例如 `HK;JP;RU` |
| `globalRatioLimit` | `2` | 自动测速允许的最大节点倍率 |
| `excludeHighPercentage` | `true` | 高倍率节点仅保留为手动选择 |
| `dns` | `true` | 是否启用脚本 DNS 配置 |
| `tun` | `null` | `null` 保留客户端设置，布尔值才显式开关 TUN |
| `allowLan` | `null` | `null` 保留客户端设置，布尔值才显式覆盖 |
| `enableDirectPortRules` | `false` | 是否启用 SSH/远控等端口直连规则 |

Provider 节点在脚本执行阶段尚未展开，因此脚本无法读取其节点名称和倍率。默认开启倍率保护时，Provider 仅加入手动选择组。

## 许可证

本项目沿用上游的 [BSD 3-Clause License](./LICENSE)，并保留原作者及上游项目归属。
