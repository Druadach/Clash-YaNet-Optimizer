# Clash-YaNet-Optimizer

面向 Clash Verge Rev、Mihomo Party 等 Mihomo 客户端的通用优化覆写脚本。

本项目基于 [dahaha-365/YaNet](https://github.com/dahaha-365/YaNet) 的
[`Mihomo/global_script.js`](https://github.com/dahaha-365/YaNet/blob/febda695a817297bacc63a37b0e0aa16d5cd00fe/Mihomo/global_script.js)
修改，基线提交为 `febda695a817297bacc63a37b0e0aa16d5cd00fe`。

## 主要优化

- 地区与全局自动测速，支持国家/地区代码识别和高倍率节点保护。
- 保留俄罗斯网站直连优先、俄罗斯节点优先的专用策略。
- 服务规则可独立启用，可通过 `ruleSet` 设置全部或按需分流。
- 保留机场节点原名，为脚本生成的代理和策略组分配唯一名称，避免同名和策略环。
- 默认保留客户端的 LAN、控制器、端口、密钥、外部 UI 和 TUN 设置。
- DNS/TUN 使用安全合并语义；关闭 DNS 时同步移除 TUN DNS 劫持。
- 远程控制端口直连规则默认关闭，可按需显式启用。
- 支持仅含 `proxy-providers` 的订阅，并过滤无效静态节点。

## 使用

将 [`clash-verge-rev-fixed.js`](./clash-verge-rev-fixed.js) 导入或粘贴到客户端的
JavaScript 覆写/扩展脚本中。也可以直接修改脚本顶部的 `defaultArgs` 设置默认行为。

远程订阅推荐使用 GitHub Raw 直链：

```text
https://raw.githubusercontent.com/Druadach/Clash-YaNet-Optimizer/main/clash-verge-rev-fixed.js
```

国内网络也可使用 jsDelivr 备用链接：

```text
https://cdn.jsdelivr.net/gh/Druadach/Clash-YaNet-Optimizer@main/clash-verge-rev-fixed.js
```

## 参数

在 SubStore 的脚本操作中设置的参数会通过 `$arguments` 传入脚本；直接粘贴到客户端时，可修改脚本顶部的 `defaultArgs`。参数名区分大小写，字符串 `true`、`false` 和数字会自动转换为对应类型；未识别的参数会被忽略。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `enable` | boolean | `true` | 总开关；设为 `false` 时原样返回输入配置。 |
| `ruleSet` | string | `all` | 默认启用全部服务组；传入 `manual` 使用内置受限组合，也可填写用分号或逗号分隔的服务 key。详见下方可用服务 key。 |
| `regionSet` | string | `all` | 生成的地区策略组。可填写用分号或逗号分隔的地区代码，例如 `HK;JP;US`；详见下方可用地区代码。 |
| `interfaceName` | string | 空字符串 | 非空时写入 Mihomo 的 `interface-name`。 |
| `excludeHighPercentage` | boolean | `true` | 是否将倍率高于 `globalRatioLimit` 的节点排除出测速组；默认仍保留在手动选择的“其他节点”组中。 |
| `globalRatioLimit` | number | `2` | 高倍率节点阈值，仅接受大于等于 `0` 的数值。 |
| `enableUrltest` | boolean | `true` | 是否将地区策略组生成为 `url-test`；关闭后地区组改为手动 `select`。 |
| `enableGlobalUrltest` | boolean | `true` | 是否生成全局自动测速组“⚡ 自动选择”。 |
| `autoDetectRegion` | boolean | `true` | 节点未匹配到地区名称或旗帜时，是否继续按名称中的地区代码自动识别。 |
| `skipIps` | string 或 string[] | 内置保留地址列表 | 嗅探器的 `skip-src-address` 列表；字符串用分号分隔。准确默认值见下方。 |
| `defaultDNS` | string 或 string[] | `119.29.29.29;223.5.5.5` | `dns.default-nameserver`，应填写 IP 地址，多个地址用分号分隔。 |
| `directDNS` | string 或 string[] | `119.29.29.29;223.5.5.5` | `dns.direct-nameserver`。 |
| `chinaDNS` | string 或 string[] | `https://doh.pub/dns-query;https://dns.alidns.com/dns-query` | `dns.nameserver`、`proxy-server-nameserver` 及中国站点 DNS 策略使用的地址。 |
| `foreignDNS` | string 或 string[] | `https://dns.google/dns-query;https://dns.adguard-dns.com/dns-query` | GFW、AI 等站点 DNS 策略使用的地址。 |
| `dns` | boolean | `true` | 控制生成的 `dns.enable`；关闭时同时移除脚本管理的 TUN DNS 劫持。 |
| `sniffer` | boolean | `false` | 控制生成的 `sniffer.enable`。 |
| `mode` | string | 空字符串 | DNS 预设：`securest`、`secure`、`default`、`fast`、`fastest`。单独传入的四个 DNS 参数优先于预设。 |
| `ipv6` | boolean | `false` | 控制生成的 `dns.ipv6`；显式传入时也会写入顶层 `ipv6`。 |
| `logLevel` | string | `error` | Mihomo 日志级别：`silent`、`error`、`warning`、`info`、`debug`。 |
| `githubProxy` | string | 空字符串 | GitHub 资源链接的前缀，例如 `https://example.com/`；使用时须自行确保末尾分隔符正确。 |
| `allowLan` | boolean 或 null | `null` | `null` 保留客户端的 `allow-lan`；传入布尔值时才覆盖。 |
| `bindAddress` | string | 空字符串 | 非空时写入 Mihomo 的 `bind-address`。 |
| `tun` | boolean 或 null | `null` | `null` 保留客户端 TUN 配置；`true` 启用或创建默认 TUN，`false` 显式关闭。 |
| `dnsListen` | string | 空字符串 | DNS 监听地址；为空时保留原配置的监听地址，否则使用 `127.0.0.1:1053`。 |
| `enableDirectPortRules` | boolean | `false` | 是否启用 SSH、远程桌面、AnyDesk、RustDesk 等端口直连规则。 |

脚本默认使用 `ruleSet=all`。在 SubStore 链接参数中传入的 `ruleSet` 会覆盖该默认值，例如 `ruleSet=github;ads` 仅启用 GitHub 和广告过滤；`ruleSet=manual` 则启用 `microsoft`、`github`、`ai`、`youtube`、`games`、`russia` 和 `ads`。

可用服务 key 为：`apple`、`microsoft`、`github`、`google`、`ai`、`spotify`、`youtube`、`bahamut`、`netflix`、`tiktok`、`disney`、`pixiv`、`hbo`、`mediahktw`、`biliintl`、`hulu`、`primevideo`、`telegram`、`line`、`whatsapp`、`games`、`japan`、`russia`、`ads`。

`regionSet` 可用地区代码为：`HK`、`US`、`JP`、`KR`、`SG`、`CN`、`TW`、`GB`、`DE`、`MY`、`TR`、`CA`、`AU`、`RU`。

`skipIps` 的默认值为：

```text
10.0.0.0/8;100.64.0.0/10;127.0.0.0/8;169.254.0.0/16;172.16.0.0/12;192.168.0.0/16;198.18.0.0/16;FC00::/7;FE80::/10;::1/128
```

Provider 节点在脚本执行阶段尚未展开，因此脚本无法读取其节点名称和倍率。默认开启倍率保护时，Provider 仅加入手动选择组。

## 许可证

本项目沿用上游的 [BSD 3-Clause License](./LICENSE)，并保留原作者及上游项目归属。