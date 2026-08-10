/***
 * Clash Verge Rev / Mihomo Party 优化脚本
 * 原作者: dahaha-365 (YaNet)
 * GitHub：https://github.com/dahaha-365/YaNet
 * 基线提交: febda695a817297bacc63a37b0e0aa16d5cd00fe
 * 优化内容: 自动测速、地区模式切换、国家代码识别、倍率识别、自定义规则与安全回退、规范分组名称、俄罗斯专用策略、自定义规则与服务开关、参数解析、DNS/TUN覆盖、非通用端口直连及无效规则配置
 */

function stringToArray(val) {
  const values = Array.isArray(val)
    ? val
    : typeof val === 'string'
      ? val.split(';')
      : []

  return values
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeTriStateBoolean(value) {
  return typeof value === 'boolean' ? value : null
}

function normalizeStringArray(value, fallback) {
  return typeof value === 'string' || Array.isArray(value)
    ? stringToArray(value)
    : stringToArray(fallback)
}

// --- 1. 静态配置区域 ---

const _skipIps =
  '10.0.0.0/8;100.64.0.0/10;127.0.0.0/8;169.254.0.0/16;172.16.0.0/12;192.168.0.0/16;198.18.0.0/16;FC00::/7;FE80::/10;::1/128'

// DNS 配置
const _chinaDohDns =
  'https://doh.pub/dns-query;https://dns.alidns.com/dns-query'
const _foreignDohDns =
  'https://dns.google/dns-query;https://dns.adguard-dns.com/dns-query'
const _chinaIpDns = '119.29.29.29;223.5.5.5'
const _foreignIpDns = '8.8.8.8;94.140.14.14'

const defaultArgs = {
  enable: true,
  ruleSet: 'all', // 默认全部启用；可通过参数传入 manual 或服务 key 列表覆盖
  regionSet: 'all',
  interfaceName: '',
  excludeHighPercentage: true,
  globalRatioLimit: 2,
  enableUrltest: true,
  enableGlobalUrltest: true,
  autoDetectRegion: true,
  skipIps: _skipIps,
  defaultDNS: _chinaIpDns,
  directDNS: _chinaIpDns,
  chinaDNS: _chinaDohDns,
  foreignDNS: _foreignDohDns,
  dns: true,
  sniffer: false,
  mode: '',
  ipv6: false,
  logLevel: 'error',
  githubProxy: '',
  allowLan: null,
  bindAddress: '',
  tun: null,
  dnsListen: '',
  enableDirectPortRules: false,
}

const rawArgs =
  typeof $arguments !== 'undefined' && isPlainObject($arguments)
    ? $arguments
    : {}

const normalizedArgumentEntries = Object.entries(rawArgs)
  .filter(([_, value]) => value !== undefined && value !== null)
  .map(([key, value]) => {
    if (typeof value !== 'string') return [key, value]

    const trimmed = value.trim()
    const lowerValue = trimmed.toLowerCase()
    if (lowerValue === 'true') return [key, true]
    if (lowerValue === 'false') return [key, false]

    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
      return [key, Number(trimmed)]
    }

    return [key, trimmed]
  })

const explicitArgKeys = new Set(normalizedArgumentEntries.map(([key]) => key))

const args = {
  ...defaultArgs,
  ...Object.fromEntries(normalizedArgumentEntries),
}

/**
 * 如果是直接在软件中粘贴脚本，可修改上面的 defaultArgs 实现自定义配置
 */
let {
  enable,
  ruleSet, // 支持 'manual'、'all' 或 'ai;youtube;ads' 这种格式
  regionSet, // 匹配 regionDefinitions.name 前两个字母 (严格大小写)
  interfaceName,
  excludeHighPercentage,
  globalRatioLimit,
  enableUrltest,
  enableGlobalUrltest,
  autoDetectRegion,
  skipIps,
  defaultDNS,
  directDNS,
  chinaDNS,
  foreignDNS,
  dns,
  sniffer,
  mode,
  ipv6,
  logLevel,
  githubProxy,
  allowLan,
  bindAddress,
  tun,
  dnsListen,
  enableDirectPortRules,
} = args

enable = normalizeBoolean(enable, defaultArgs.enable)
ruleSet =
  typeof ruleSet === 'string' && ruleSet.length > 0
    ? ruleSet.toLowerCase()
    : defaultArgs.ruleSet
regionSet =
  typeof regionSet === 'string' && regionSet.length > 0
    ? regionSet.toUpperCase()
    : defaultArgs.regionSet.toUpperCase()
interfaceName = typeof interfaceName === 'string' ? interfaceName : ''
excludeHighPercentage = normalizeBoolean(
  excludeHighPercentage,
  defaultArgs.excludeHighPercentage
)
enableUrltest = normalizeBoolean(enableUrltest, defaultArgs.enableUrltest)
enableGlobalUrltest = normalizeBoolean(
  enableGlobalUrltest,
  defaultArgs.enableGlobalUrltest
)
autoDetectRegion = normalizeBoolean(
  autoDetectRegion,
  defaultArgs.autoDetectRegion
)
dns = normalizeBoolean(dns, defaultArgs.dns)
sniffer = normalizeBoolean(sniffer, defaultArgs.sniffer)
ipv6 = normalizeBoolean(ipv6, defaultArgs.ipv6)
mode = typeof mode === 'string' ? mode.toLowerCase() : ''
logLevel =
  typeof logLevel === 'string' &&
  ['silent', 'error', 'warning', 'info', 'debug'].includes(logLevel.toLowerCase())
    ? logLevel.toLowerCase()
    : defaultArgs.logLevel
githubProxy = typeof githubProxy === 'string' ? githubProxy : ''
allowLan = normalizeTriStateBoolean(allowLan)
bindAddress = typeof bindAddress === 'string' ? bindAddress : ''
tun = normalizeTriStateBoolean(tun)
dnsListen = typeof dnsListen === 'string' ? dnsListen : ''
enableDirectPortRules = normalizeBoolean(
  enableDirectPortRules,
  defaultArgs.enableDirectPortRules
)

/**
 * 模式配置
 */
const dnsModePresets = {
  securest: {
    defaultDNS: _foreignIpDns,
    directDNS: _foreignDohDns,
  },
  secure: {
    defaultDNS: _foreignIpDns,
    directDNS: _chinaDohDns,
    chinaDNS: _chinaDohDns,
    foreignDNS: _foreignDohDns,
  },
  default: {
    defaultDNS: _chinaIpDns,
    directDNS: _chinaIpDns,
    chinaDNS: _chinaDohDns,
    foreignDNS: _foreignDohDns,
  },
  fast: {
    defaultDNS: _chinaIpDns,
    directDNS: _chinaIpDns,
    chinaDNS: _chinaIpDns,
    foreignDNS: _chinaDohDns,
  },
  fastest: {
    defaultDNS: _chinaIpDns,
    directDNS: _chinaIpDns,
    chinaDNS: _chinaIpDns,
    foreignDNS: _chinaIpDns,
  },
}

if (Object.prototype.hasOwnProperty.call(dnsModePresets, mode)) {
  Object.entries(dnsModePresets[mode]).forEach(([key, value]) => {
    if (explicitArgKeys.has(key)) return
    if (key === 'defaultDNS') defaultDNS = value
    if (key === 'directDNS') directDNS = value
    if (key === 'chinaDNS') chinaDNS = value
    if (key === 'foreignDNS') foreignDNS = value
  })
}

skipIps = normalizeStringArray(skipIps, defaultArgs.skipIps)
defaultDNS = normalizeStringArray(defaultDNS, defaultArgs.defaultDNS)
directDNS = normalizeStringArray(directDNS, defaultArgs.directDNS)
chinaDNS = normalizeStringArray(chinaDNS, defaultArgs.chinaDNS)
foreignDNS = normalizeStringArray(foreignDNS, defaultArgs.foreignDNS)

/**
 * 分流规则配置，会自动生成对应的策略组
 * 设置的时候可遵循“最小，可用”原则，把自己不需要的规则全禁用掉，提高效率
 * true = 启用
 * false = 禁用
 */
const ruleOptions = {
  apple: false,
  microsoft: true,
  github: true,
  google: false,
  ai: true,
  spotify: false,
  youtube: true,
  bahamut: false,
  netflix: false,
  tiktok: false,
  disney: false,
  pixiv: false,
  hbo: false,
  mediahktw: false,
  biliintl: false,
  hulu: false,
  primevideo: false,
  telegram: false,
  line: false,
  whatsapp: false,
  games: true,
  japan: false,
  russia: true,
  ads: true,
}

if (ruleSet === 'all') {
  Object.keys(ruleOptions).forEach((key) => (ruleOptions[key] = true))
} else if (typeof ruleSet === 'string' && ruleSet !== 'manual') {
  Object.keys(ruleOptions).forEach((key) => (ruleOptions[key] = false))
  const enabledKeys = ruleSet
    .split(/[;,]/)
    .map((s) => s.trim().toLowerCase())
    .filter((key) => key.length > 0)
  enabledKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(ruleOptions, key)) {
      ruleOptions[key] = true
    }
  })
}

// 初始规则
const directPortRules = [
  'DST-PORT,22,直连', // Git SSH（必须放首位，防止密钥协商失败）
  'DST-PORT,3389,直连', // Windows远程连接
  'DST-PORT,5938,直连', // TeamViewer（核心端口，含TCP/UDP）
  'DST-PORT,7070,直连', // AnyDesk（主端口，含TCP/UDP音视频流）
  'DST-PORT,19966,直连', // 向日葵远程控制
  'DST-PORT,21114-21119,直连', // RustDesk（含WebSocket中继端口）
  'DST-PORT,4118,直连', // 蒲公英P2P穿透
  'DST-PORT,7654,直连', // N2N SuperNode端口
  'DST-PORT,9118,直连', // 节点小宝端口
  'DST-PORT,50000-50100,直连', // AnyDesk/RustDesk备用中继端口（关键！）
  'DST-PORT,5353,直连', // 向日葵内网穿透
]

const baseRules = [
  'GEOSITE,category-collaborate-cn,直连',
  'GEOSITE,category-container,默认节点',
  // 'GEOSITE,category-netdisk-!cn,默认节点',
  'RULE-SET,applications,下载软件',
]

// 自定义规则只描述数据，生成逻辑负责转换为 Mihomo 规则。
const customRules = {
  // direct: {
  //   target: '直连',
  //   domainSuffix: [],
  //   domainKeyword: [],
  //   domain: [],
  //   processName: [],
  //   ruleSets: [],
  // },
}

const customRuleTypeMap = {
  domainSuffix: 'DOMAIN-SUFFIX',
  domainKeyword: 'DOMAIN-KEYWORD',
  domain: 'DOMAIN',
  processName: 'PROCESS-NAME',
  ruleSets: 'RULE-SET',
}

function generateCustomRules(ruleConfigs) {
  const generatedRules = []

  Object.values(ruleConfigs).forEach((ruleConfig) => {
    if (ruleConfig.enabled === false || !ruleConfig.target) return

    Object.entries(customRuleTypeMap).forEach(([field, ruleType]) => {
      const values = ruleConfig[field]
      if (!Array.isArray(values)) return

      values.forEach((value) => {
        const normalizedValue = typeof value === 'string' ? value.trim() : ''
        if (normalizedValue.length > 0) {
          generatedRules.push(`${ruleType},${normalizedValue},${ruleConfig.target}`)
        }
      })
    })
  })

  return generatedRules
}

// 地区定义 (Icons 更新为 GitHub Raw)
const allRegionDefinitions = [
  {
    name: 'HK香港',
    regex: /港|🇭🇰|hongkong|hong kong/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Hong_Kong.png',
  },
  {
    name: 'US美国',
    regex: /美|🇺🇸|american|united states/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/United_States.png',
  },
  {
    name: 'JP日本',
    regex: /日本|🇯🇵|japan|iij/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Japan.png',
  },
  {
    name: 'KR韩国',
    regex: /韩|🇰🇷|korea/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Korea.png',
  },
  {
    name: 'SG新加坡',
    regex: /新加坡|🇸🇬|singapore/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Singapore.png',
  },
  {
    name: 'CN中国大陆',
    regex: /中国|🇨🇳|china/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/China_Map.png',
  },
  {
    name: 'TW台湾省',
    regex: /台湾|台灣|🇹🇼|taiwan|tai wan/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/China.png',
  },
  {
    name: 'GB英国',
    regex: /英|🇬🇧|united kingdom|great britain/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/United_Kingdom.png',
  },
  {
    name: 'DE德国',
    regex: /德国|🇩🇪|germany/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Germany.png',
  },
  {
    name: 'MY马来西亚',
    regex: /马来|🇲🇾|malaysia/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Malaysia.png',
  },
  {
    name: 'TR土耳其',
    regex: /土耳其|🇹🇷|turkey/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Turkey.png',
  },
  {
    name: 'CA加拿大',
    regex: /加拿大|🇨🇦|canada/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Canada.png',
  },
  {
    name: 'AU澳大利亚',
    regex: /澳大利亚|🇦🇺|australia|sydney/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Australia.png',
  },
  {
    name: 'RU俄罗斯',
    regex: /(?:^|[^白])(?:俄罗斯|俄羅斯)|🇷🇺|\brussia(?:n)?\b/i,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/RU.png',
  },
]

const regionCodeToName = {
  HKG: 'HK香港',
  HK: 'HK香港',
  USA: 'US美国',
  US: 'US美国',
  JPN: 'JP日本',
  JP: 'JP日本',
  KOR: 'KR韩国',
  KR: 'KR韩国',
  SGP: 'SG新加坡',
  SG: 'SG新加坡',
  CHN: 'CN中国大陆',
  CN: 'CN中国大陆',
  TWN: 'TW台湾省',
  TW: 'TW台湾省',
  GBR: 'GB英国',
  GB: 'GB英国',
  UK: 'GB英国',
  DEU: 'DE德国',
  DE: 'DE德国',
  MYS: 'MY马来西亚',
  MY: 'MY马来西亚',
  TUR: 'TR土耳其',
  TR: 'TR土耳其',
  CAN: 'CA加拿大',
  CA: 'CA加拿大',
  AUS: 'AU澳大利亚',
  AU: 'AU澳大利亚',
  RUS: 'RU俄罗斯',
  RU: 'RU俄罗斯',
}

const regionCodeMatchers = Object.entries(regionCodeToName)
  .sort(([left], [right]) => right.length - left.length)
  .map(([code, regionName]) => ({
    regionName,
    regex: new RegExp(`(?:^|[^A-Z])${code}(?:[^A-Z]|$)`),
  }))

function detectRegionName(name) {
  const upperName = name.toUpperCase()
  const matchedCode = regionCodeMatchers.find(({ regex }) => regex.test(upperName))
  return matchedCode?.regionName || null
}

let regionDefinitions = []
if (regionSet === 'ALL') {
  regionDefinitions = allRegionDefinitions
} else {
  const enabledRegions = regionSet
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((code) => code.length > 0)
  regionDefinitions = allRegionDefinitions.filter((r) => {
    const prefix = r.name.substring(0, 2) // 获取前两个字母
    return enabledRegions.includes(prefix)
  })
}

const dnsConfig = {
  enable: !!dns,
  ipv6: !!ipv6,
  'prefer-h3': true,
  'use-hosts': true,
  'use-system-hosts': true,
  'respect-rules': true,
  'enhanced-mode': 'fake-ip',
  'fake-ip-range': '198.18.0.0/16',
  'fake-ip-filter-mode': 'whitelist',
  'fake-ip-filter': [
    'geosite:jetbrains-ai',
    'geosite:category-ai-!cn',
    'geosite:category-ai-chat-!cn',
    'geosite:category-games-!cn',
    'geosite:category-cdn-!cn',
    'geosite:telegram',
    // 'geosite:x',
    'geosite:google',
    'geosite:amazon',
    'geosite:category-bank-jp',
    'geosite:category-communication',
    'geosite:gfw',
    // 'geosite:geolocation-!cn',
  ],
  nameserver: chinaDNS,
  'default-nameserver': defaultDNS,
  'direct-nameserver': directDNS,
  // fallback: foreignDNS,
  // 'fallback-filter': {
  //   geoip: true,
  //   'geoip-code': 'CN',
  // },
  'proxy-server-nameserver': chinaDNS,
  'nameserver-policy': {
    'geosite:private': 'system',
    'geosite:tld-cn,cn,steam@cn,category-games@cn,microsoft@cn,apple@cn,category-game-platforms-download@cn,category-public-tracker':
    chinaDNS,
    'geosite:gfw,jetbrains-ai,category-ai-!cn,category-ai-chat-!cn': foreignDNS,
    // 'geosite:telegram': foreignDNS,
  },
}

// 通用配置
const ruleProviderCommon = {
  type: 'http',
  format: 'yaml',
  interval: 86400,
}
const groupBaseOption = {
  interval: 300,
  timeout: 3000,
  url: 'https://www.gstatic.com/generate_204',
  lazy: true,
  'max-failed-times': 3,
  hidden: false,
}
const GLOBAL_AUTO_GROUP_NAME = '⚡ 自动选择'

// 自定义规则集会自动继承公共下载配置。
const customRuleSets = {
  // example: {
  //   behavior: 'domain',
  //   format: 'mrs',
  //   url: 'https://example.com/example.mrs',
  //   path: './ruleset/custom/example.mrs',
  // },
}

// 预定义 Rule Providers
const baseRuleProviders = {
  applications: {
    ...ruleProviderCommon,
    behavior: 'classical',
    format: 'text',
    url: 'https://github.com/DustinWin/ruleset_geodata/raw/refs/heads/mihomo-ruleset/applications.list',
    path: './ruleset/DustinWin/applications.list',
  },
  ...Object.fromEntries(
    Object.entries(customRuleSets).map(([name, provider]) => [
      name,
      { ...ruleProviderCommon, ...provider },
    ])
  ),
}

// 倍率正则预编译
const multiplierRegex =
  /(?:[xX×✕✖⨉]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*[xX×✕✖⨉]|倍率\s*[:：]?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*倍(?:率)?)/i

function getProxyMultiplier(name) {
  const match = multiplierRegex.exec(name)
  if (!match) return 1

  const value = match.slice(1).find((part) => part !== undefined)
  return Number(value)
}

// --- 2. 服务规则数据结构 ---
// Icons 更新为 GitHub Raw
const serviceConfigs = [
  {
    key: 'ai',
    name: '国外AI',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/ChatGPT.png',
    url: 'https://chat.openai.com/cdn-cgi/trace',
    rules: [
      'GEOSITE,jetbrains-ai,国外AI',
      'GEOSITE,category-ai-!cn,国外AI',
      'GEOSITE,category-ai-chat-!cn,国外AI',
      'DOMAIN-SUFFIX,meta.ai,国外AI',
      'DOMAIN-SUFFIX,meta.com,国外AI',
    ],
  },
  {
    key: 'youtube',
    name: 'YouTube',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/YouTube.png',
    url: 'https://www.youtube.com/s/desktop/494dd881/img/favicon.ico',
    rules: ['GEOSITE,youtube,YouTube'],
  },
  {
    key: 'mediahktw',
    name: '港台服务',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/TVB.png',
    url: 'https://viu.tv/',
    rules: [
      'GEOSITE,tvb,港台服务',
      'GEOSITE,hkt,港台服务',
      'GEOSITE,hkbn,港台服务',
      'GEOSITE,hkopentv,港台服务',
      'GEOSITE,hkedcity,港台服务',
      'GEOSITE,hkgolden,港台服务',
      'GEOSITE,hketgroup,港台服务',
      'RULE-SET,hk-media,港台服务',
      'RULE-SET,tw-media,港台服务',
    ],
    providers: [
      {
        key: 'hk-media',
        url: 'https://ruleset.skk.moe/Clash/non_ip/stream_hk.txt',
        path: './ruleset/ruleset.skk.moe/stream_hk.txt',
        format: 'text',
        behavior: 'classical',
      },
      {
        key: 'tw-media',
        url: 'https://ruleset.skk.moe/Clash/non_ip/stream_tw.txt',
        path: './ruleset/ruleset.skk.moe/stream_tw.txt',
        format: 'text',
        behavior: 'classical',
      },
    ],
  },
  {
    key: 'biliintl',
    name: '哔哩哔哩国际版',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/bilibili_3.png',
    url: 'https://www.bilibili.tv/',
    rules: ['GEOSITE,biliintl,哔哩哔哩国际版'],
  },
  {
    key: 'bahamut',
    name: '巴哈姆特',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Bahamut.png',
    url: 'https://ani.gamer.com.tw/ajax/getdeviceid.php',
    rules: ['GEOSITE,bahamut,巴哈姆特'],
  },
  {
    key: 'disney',
    name: 'Disney+',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Disney+.png',
    url: 'https://disney.api.edge.bamgrid.com/devices',
    rules: ['GEOSITE,disney,Disney+'],
  },
  {
    key: 'netflix',
    name: 'Netflix',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Netflix.png',
    url: 'https://api.fast.com/netflix/speedtest/v2?https=true',
    rules: ['GEOSITE,netflix,Netflix'],
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/TikTok.png',
    url: 'https://www.tiktok.com/',
    rules: ['GEOSITE,tiktok,TikTok'],
  },
  {
    key: 'spotify',
    name: 'Spotify',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Spotify.png',
    url: 'https://spclient.wg.spotify.com/signup/public/v1/account',
    rules: ['GEOSITE,spotify,Spotify'],
  },
  {
    key: 'pixiv',
    name: 'pixiv',
    icon: 'https://play-lh.googleusercontent.com/8pFuLOHF62ADcN0ISUAyEueA5G8IF49mX_6Az6pQNtokNVHxIVbS1L2NM62H-k02rLM=w240-h480-rw',
    url: 'https://www.pixiv.net/favicon.ico',
    rules: ['GEOSITE,pixiv,pixiv'],
  },
  {
    key: 'hbo',
    name: 'HBO',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/HBO.png',
    url: 'https://www.hbo.com/favicon.ico',
    rules: ['GEOSITE,hbo,HBO'],
  },
  {
    key: 'primevideo',
    name: 'Prime Video',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Prime_Video.png',
    url: 'https://m.media-amazon.com/images/G/01/digital/video/web/logo-min-remaster.png',
    rules: ['GEOSITE,primevideo,Prime Video'],
  },
  {
    key: 'hulu',
    name: 'Hulu',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Hulu.png',
    url: 'https://auth.hulu.com/v4/web/password/authenticate',
    rules: ['GEOSITE,hulu,Hulu'],
  },
  {
    key: 'telegram',
    name: 'Telegram',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Telegram.png',
    url: 'https://www.telegram.org/img/website_icon.svg',
    rules: ['GEOIP,telegram,Telegram'],
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    icon: 'https://static.whatsapp.net/rsrc.php/v3/yP/r/rYZqPCBaG70.png',
    url: 'https://web.whatsapp.com/data/manifest.json',
    rules: ['GEOSITE,whatsapp,WhatsApp'],
  },
  {
    key: 'line',
    name: 'LINE',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Line.png',
    url: 'https://line.me/page-data/app-data.json',
    rules: ['GEOSITE,line,LINE'],
  },
  {
    key: 'games',
    name: '游戏专用',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Game.png',
    rules: [
      'GEOSITE,category-games@cn,国内网站',
      'GEOSITE,category-games,游戏专用',
    ],
  },
  {
    key: 'ads',
    name: '广告过滤',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Advertising.png',
    rules: [
      'GEOSITE,category-ads-all,广告过滤',
      'RULE-SET,adblockmihomo,广告过滤',
    ],
    providers: [
      {
        key: 'adblockmihomo',
        url: 'https://github.com/217heidai/adblockfilters/raw/refs/heads/main/rules/adblockmihomo.mrs',
        path: './ruleset/adblockfilters/adblockmihomo.mrs',
        format: 'mrs',
        behavior: 'domain',
      },
    ],
    reject: true,
  },
  {
    key: 'apple',
    name: '苹果中国区',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Apple_2.png',
    url: 'https://www.apple.com/library/test/success.html',
    rules: ['GEOSITE,apple-cn,苹果中国区'],
  },
  {
    key: 'google',
    name: '谷歌服务',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Google_Search.png',
    url: 'https://www.google.com/generate_204',
    rules: ['GEOSITE,google,谷歌服务'],
  },
  {
    key: 'github',
    name: 'GitHub',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/GitHub.png',
    url: 'https://github.com/robots.txt',
    rules: ['GEOSITE,github,GitHub'],
  },
  {
    key: 'microsoft',
    name: '微软服务',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Microsoft.png',
    url: 'https://www.msftconnecttest.com/connecttest.txt',
    rules: ['GEOSITE,microsoft@cn,国内网站', 'GEOSITE,microsoft,微软服务'],
  },
  {
    key: 'japan',
    name: '日本网站',
    preferredRegion: 'JP日本',
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/JP.png',
    url: 'https://r.r10s.jp/com/img/home/logo/touch.png',
    rules: [
      'RULE-SET,category-bank-jp,日本网站',
      'GEOIP,jp,日本网站,no-resolve',
    ],
    providers: [
      {
        key: 'category-bank-jp',
        url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-bank-jp.mrs',
        path: './ruleset/MetaCubeX/category-bank-jp.mrs',
        format: 'mrs',
        behavior: 'domain',
      },
    ],
  },
  {
    key: 'russia',
    name: '俄罗斯网站',
    preferredRegion: 'RU俄罗斯',
    directFirst: true,
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/RU.png',
    url: 'https://ya.ru',
    rules: [
      'DOMAIN-SUFFIX,ru,俄罗斯网站',
      'DOMAIN-SUFFIX,vk.com,俄罗斯网站',
      'DOMAIN-SUFFIX,yandex.com,俄罗斯网站',
      'GEOIP,RU,俄罗斯网站,no-resolve',
    ],
  },
]

// --- 3. 主入口 ---

function main(config) {
  if (!enable) return config

  if (!isPlainObject(config)) {
    throw new Error('配置文件格式无效')
  }

  const inputProxies = Array.isArray(config.proxies) ? config.proxies : []
  const proxies = inputProxies.filter(
    (proxy) =>
      isPlainObject(proxy) &&
      typeof proxy.name === 'string' &&
      proxy.name.trim().length > 0 &&
      typeof proxy.type === 'string' &&
      proxy.type.trim().length > 0
  )
  const proxyProviders = config['proxy-providers']
  const proxyProviderNames =
    isPlainObject(proxyProviders)
      ? Object.entries(proxyProviders)
          .filter(([_, provider]) => isPlainObject(provider))
          .map(([name]) => name)
      : []

  if (proxies.length === 0 && proxyProviderNames.length === 0) {
    throw new Error('配置文件中未找到任何代理')
  }

  const staticProxyNames = proxies.map((proxy) => proxy.name)
  if (new Set(staticProxyNames).size !== staticProxyNames.length) {
    throw new Error('配置文件中存在同名代理，无法安全生成策略组')
  }

  const usedNames = new Set(staticProxyNames)
  const allocateName = (preferredName, suffixLabel) => {
    if (!usedNames.has(preferredName)) {
      usedNames.add(preferredName)
      return preferredName
    }

    const baseName = `${preferredName}（${suffixLabel}）`
    if (!usedNames.has(baseName)) {
      usedNames.add(baseName)
      return baseName
    }

    let index = 2
    let candidate = `${preferredName}（${suffixLabel} ${index}）`
    while (usedNames.has(candidate)) {
      index += 1
      candidate = `${preferredName}（${suffixLabel} ${index}）`
    }
    usedNames.add(candidate)
    return candidate
  }

  const ensureBuiltInProxy = (logicalName, type, extraOptions) => {
    const reusableProxy = proxies.find((proxy) => {
      if (proxy.type.toLowerCase() !== type) return false
      if (proxy.name === logicalName) return true
      return (
        proxy.name.startsWith(`${logicalName}（内置`) &&
        proxy.name.endsWith('）')
      )
    })
    if (reusableProxy) return reusableProxy.name

    const name = allocateName(logicalName, '内置')
    proxies.push({ name, type, ...extraOptions })
    return name
  }

  const directProxyName = ensureBuiltInProxy('直连', 'direct', { udp: true })
  const rejectProxyName = ensureBuiltInProxy('拒绝', 'reject', { udp: false })
  const policyNames = new Map([
    ['直连', directProxyName],
    ['拒绝', rejectProxyName],
  ])
  const allocatePolicyName = (logicalName) => {
    if (policyNames.has(logicalName)) return policyNames.get(logicalName)
    const actualName = allocateName(logicalName, '脚本')
    policyNames.set(logicalName, actualName)
    return actualName
  }

  config.proxies = proxies
  const rules = [
    ...(enableDirectPortRules ? directPortRules : []),
    ...baseRules,
    ...generateCustomRules(customRules),
  ]
  const ruleProviders = { ...baseRuleProviders }
  const parsedRatioLimit = Number(globalRatioLimit)
  const ratioLimit =
    Number.isFinite(parsedRatioLimit) && parsedRatioLimit >= 0
      ? parsedRatioLimit
      : defaultArgs.globalRatioLimit

  // 3.1 应用通用优化，不覆盖 Clash 客户端负责的端口、控制器和 UI 设置。
  if (allowLan !== null) config['allow-lan'] = allowLan
  if (bindAddress.length > 0) config['bind-address'] = bindAddress
  config['mode'] = 'rule'
  if (explicitArgKeys.has('ipv6')) config['ipv6'] = ipv6
  config['log-level'] = logLevel

  const existingDns = isPlainObject(config.dns) ? config.dns : {}
  const existingDnsListen =
    typeof existingDns.listen === 'string' ? existingDns.listen.trim() : ''
  config['dns'] = {
    ...existingDns,
    ...dnsConfig,
    listen: dnsListen || existingDnsListen || '127.0.0.1:1053',
  }
  delete config['dns']['log-level']
  config['profile'] = {
    ...(isPlainObject(config.profile) ? config.profile : {}),
    'store-selected': true,
    'store-fake-ip': true,
  }
  config['unified-delay'] = true
  config['tcp-concurrent'] = true
  config['keep-alive-interval'] = 1800
  config['find-process-mode'] = 'strict'
  config['geodata-mode'] = false
  config['geodata-loader'] = 'memconservative'
  config['geo-auto-update'] = true
  config['geo-update-interval'] = 24

  if (interfaceName.length > 0) config['interface-name'] = interfaceName

  config['sniffer'] = {
    enable: sniffer,
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': true,
    sniff: {
      TLS: {
        ports: [443, 8443],
      },
      HTTP: {
        ports: [80, '8080-8880'],
      },
      QUIC: {
        ports: [443, 8443],
      },
    },
    'skip-src-address': skipIps.filter((ip) => ip !== '198.18.0.0/16'),
    // 'skip-dst-address': skipIps,
    // 'force-domain': [
    //   '+.google.com',
    //   '+.googleapis.com',
    //   '+.googleusercontent.com',
    //   '+.youtube.com',
    //   '+.facebook.com',
    //   '+.messenger.com',
    //   '+.fbcdn.net',
    //   'fbcdn-a.akamaihd.net',
    // ],
    'skip-domain': ['Mijia Cloud', '+.oray.com'],
  }

  config['ntp'] = {
    ...(isPlainObject(config.ntp) ? config.ntp : {}),
    enable: true,
    'write-to-system': false,
    server: 'cn.ntp.org.cn',
  }
  const existingTun = isPlainObject(config.tun) ? config.tun : null
  let nextTun = existingTun
  if (tun !== null) {
    nextTun = existingTun
      ? { ...existingTun, enable: tun }
      : tun
        ? {
            enable: true,
            stack: 'mixed',
            'auto-route': true,
            'auto-detect-interface': true,
            ...(dns ? { 'dns-hijack': ['any:53', 'tcp://any:53'] } : {}),
          }
        : { enable: false }
  }
  if (!dns && nextTun) {
    nextTun = { ...nextTun }
    delete nextTun['dns-hijack']
  }
  if (nextTun) config['tun'] = nextTun

  config['geox-url'] = {
    ...(isPlainObject(config['geox-url']) ? config['geox-url'] : {}),
    geoip: `${githubProxy}https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat`,
    geosite: `${githubProxy}https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat`,
    mmdb: `${githubProxy}https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb`,
    asn: `${githubProxy}https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb`,
  }

  // 3.2 高效代理分类 (单次遍历)
  const regionGroups = {}
  regionDefinitions.forEach(
    (r) =>
      (regionGroups[r.name] = {
        ...r,
        proxies: [],
      })
  )
  const otherProxies = []
  const eligibleProxyNames = []
  const virtualProxyTypes = new Set(['direct', 'reject', 'pass', 'compatible'])

  for (const proxy of proxies) {
    const name = proxy.name
    let matched = false

    if (
      typeof name !== 'string' ||
      virtualProxyTypes.has(String(proxy.type).toLowerCase())
    ) {
      continue
    }

    const exceedsRatioLimit =
      !!excludeHighPercentage && getProxyMultiplier(name) > ratioLimit

    if (!exceedsRatioLimit) {
      eligibleProxyNames.push(name)
    } else if (enableUrltest) {
      // 高倍率节点保留给手动选择，但不加入任何测速组。
      otherProxies.push(name)
      continue
    }

    // 尝试匹配地区
    for (const region of regionDefinitions) {
      if (region.regex.test(name)) {
        regionGroups[region.name].proxies.push(name)
        matched = true
        break
      }
    }

    if (!matched && autoDetectRegion) {
      const detectedRegionName = detectRegionName(name)
      if (detectedRegionName && regionGroups[detectedRegionName]) {
        regionGroups[detectedRegionName].proxies.push(name)
        matched = true
      }
    }

    if (!matched) {
      otherProxies.push(name)
    }
  }

  const generatedRegionGroups = []
  const regionPolicyNames = new Map()
  regionDefinitions.forEach((r) => {
    const groupData = regionGroups[r.name]
    if (groupData.proxies.length > 0) {
      const actualName = allocatePolicyName(r.name)
      regionPolicyNames.set(r.name, actualName)
      generatedRegionGroups.push({
        ...groupBaseOption,
        name: actualName,
        ...(enableUrltest
          ? { type: 'url-test', tolerance: 50 }
          : { type: 'select' }),
        icon: r.icon,
        proxies: groupData.proxies,
      })
    }
  })

  const regionGroupNames = generatedRegionGroups.map((group) => group.name)
  const hasOtherGroup =
    otherProxies.length > 0 || proxyProviderNames.length > 0
  const otherGroupName = hasOtherGroup
    ? allocatePolicyName('其他节点')
    : null

  if (hasOtherGroup) {
    generatedRegionGroups.push({
      ...groupBaseOption,
      name: otherGroupName,
      type: 'select',
      ...(otherProxies.length > 0 ? { proxies: otherProxies } : {}),
      ...(proxyProviderNames.length > 0 ? { use: proxyProviderNames } : {}),
      icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/World_Map.png',
    })
  }

  // Provider 节点名在脚本阶段不可见，开启倍率保护时不让它们参与测速。
  const globalAutoProviderNames = excludeHighPercentage
    ? []
    : proxyProviderNames
  const hasGlobalAutoGroup =
    enableGlobalUrltest &&
    (eligibleProxyNames.length > 0 || globalAutoProviderNames.length > 0)
  const globalAutoGroupName = hasGlobalAutoGroup
    ? allocatePolicyName(GLOBAL_AUTO_GROUP_NAME)
    : null
  const globalAutoGroup = hasGlobalAutoGroup
    ? {
        ...groupBaseOption,
        name: globalAutoGroupName,
        type: 'url-test',
        tolerance: 50,
        ...(eligibleProxyNames.length > 0
          ? { proxies: eligibleProxyNames }
          : {}),
        ...(globalAutoProviderNames.length > 0
          ? { use: globalAutoProviderNames }
          : {}),
      }
    : null

  // 3.3 构建功能策略组
  const functionalGroups = []
  const defaultGroupName = allocatePolicyName('默认节点')
  const downloadGroupName = allocatePolicyName('下载软件')
  const otherTrafficGroupName = allocatePolicyName('其他网站')
  const domesticGroupName = allocatePolicyName('国内网站')

  functionalGroups.push({
    ...groupBaseOption,
    name: defaultGroupName,
    type: 'select',
    proxies: [
      ...(globalAutoGroup ? [globalAutoGroupName] : []),
      ...regionGroupNames,
      ...(otherGroupName ? [otherGroupName] : []),
      directProxyName,
    ],
    icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Proxy.png',
  })

  const buildPreferredServiceProxies = (service) => {
    const preferredRegionName = regionPolicyNames.get(service.preferredRegion)
    const hasPreferredRegion = typeof preferredRegionName === 'string'
    const otherRegions = hasPreferredRegion
      ? regionGroupNames.filter((name) => name !== preferredRegionName)
      : regionGroupNames

    if (service.directFirst) {
      return [
        directProxyName,
        ...(hasPreferredRegion ? [preferredRegionName] : []),
        defaultGroupName,
        ...otherRegions,
      ]
    }

    return hasPreferredRegion
      ? [preferredRegionName, defaultGroupName, ...otherRegions, directProxyName]
      : [defaultGroupName, ...otherRegions, directProxyName]
  }

  serviceConfigs.forEach((svc) => {
    if (ruleOptions[svc.key]) {
      rules.push(...svc.rules)

      if (Array.isArray(svc.providers)) {
        svc.providers.forEach((p) => {
          ruleProviders[p.key] = {
            ...ruleProviderCommon,
            behavior: p.behavior,
            format: p.format,
            url: p.url,
            path: p.path,
          }
        })
      }

      let groupProxies
      if (svc.reject) {
        groupProxies = [rejectProxyName, directProxyName, defaultGroupName]
      } else if (svc.key === 'biliintl' || svc.key === 'bahamut') {
        groupProxies = [defaultGroupName, directProxyName, ...regionGroupNames]
      } else {
        groupProxies = buildPreferredServiceProxies(svc)
      }

      functionalGroups.push({
        ...groupBaseOption,
        name: allocatePolicyName(svc.name),
        type: 'select',
        proxies: groupProxies,
        url: svc.url,
        icon: svc.icon,
      })
    }
  })

  // 3.4 添加通用兜底策略组
  rules.push(
    'GEOSITE,private,直连',
    'GEOSITE,category-public-tracker,直连',
    'GEOSITE,category-game-platforms-download@cn,直连',
    'GEOSITE,category-remote-control,直连',
    'GEOIP,private,直连,no-resolve',
    'GEOSITE,cn,直连',
    'GEOIP,cn,直连,no-resolve',
    // 'GEOSITE,geolocation-!cn,其他网站',
    'MATCH,其他网站'
  )

  functionalGroups.push(
    {
      ...groupBaseOption,
      name: downloadGroupName,
      type: 'select',
      proxies: [
        directProxyName,
        rejectProxyName,
        defaultGroupName,
        ...regionGroupNames,
      ],
      icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Download.png',
    },
    {
      ...groupBaseOption,
      name: otherTrafficGroupName,
      type: 'select',
      proxies: [defaultGroupName, directProxyName, ...regionGroupNames],
      icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Streaming!CN.png',
    },
    {
      ...groupBaseOption,
      name: domesticGroupName,
      type: 'select',
      proxies: [directProxyName, defaultGroupName, ...regionGroupNames],
      url: 'https://wifi.vivo.com.cn/generate_204',
      icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/StreamingCN.png',
    }
  )

  // 3.5 组装最终结果
  config['proxy-groups'] = [
    ...functionalGroups,
    ...(globalAutoGroup ? [globalAutoGroup] : []),
    ...generatedRegionGroups.sort((a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    ),
  ]

  const remapRulePolicy = (rule) => {
    if (typeof rule !== 'string') return rule
    const parts = rule.split(',')
    const ruleType = parts[0].trim().toUpperCase()
    const policyIndex = ruleType === 'MATCH' || ruleType === 'FINAL' ? 1 : 2
    if (parts.length <= policyIndex) return rule

    const logicalPolicy = parts[policyIndex].trim()
    if (policyNames.has(logicalPolicy)) {
      parts[policyIndex] = policyNames.get(logicalPolicy)
    }
    return parts.join(',')
  }

  config['rules'] = rules.map(remapRulePolicy)
  config['rule-providers'] = {
    ...(isPlainObject(config['rule-providers'])
      ? config['rule-providers']
      : {}),
    ...ruleProviders,
  }

  return config
}
