/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'

export function useTimezone() {
  const allTimezones = ref<{ id: string; region: string; cityInfo: string; offset: string; searchStr: string }[]>([])
  const timezoneSearch = ref('')
  const activeTimezoneTab = ref(localStorage.getItem('clingy_last_timezone_tab') || '本地')

  const populateTimezones = () => {
    try {
      const tzs = Intl.supportedValuesOf('timeZone')
      const regionMap: Record<string, string> = {
        'Asia': '亚洲', 'America': '美洲', 'Europe': '欧洲', 'Africa': '非洲', 
        'Australia': '大洋洲', 'Pacific': '太平洋', 'Indian': '印度洋', 
        'Antarctica': '南极洲', 'Atlantic': '大西洋'
      }
      const cityMap: Record<string, string> = {
        'Shanghai': '中国 - 上海 (北京时间)', 'Urumqi': '中国 - 乌鲁木齐', 'Chongqing': '中国 - 重庆', 'Harbin': '中国 - 哈尔滨',
        'Hong_Kong': '中国 - 香港', 'Macau': '中国 - 澳门', 'Taipei': '中国 - 台北',
        'Tokyo': '日本 - 东京', 'Seoul': '韩国 - 首尔', 'Pyongyang': '朝鲜 - 平壤', 'Singapore': '新加坡',
        'Bangkok': '泰国 - 曼谷', 'Jakarta': '印尼 - 雅加达', 'Kuala_Lumpur': '马来西亚 - 吉隆坡',
        'Manila': '菲律宾 - 马尼拉', 'Ho_Chi_Minh': '越南 - 胡志明', 'Dubai': '阿联酋 - 迪拜',
        'Riyadh': '沙特阿拉伯 - 利雅得', 'Tehran': '伊朗 - 德黑兰', 'Kabul': '阿富汗 - 喀布尔',
        'Karachi': '巴基斯坦 - 卡拉奇', 'Kolkata': '印度 - 加尔各答', 'Colombo': '斯里兰卡 - 科伦坡',
        'Dhaka': '孟加拉国 - 达卡', 'Baghdad': '伊拉克 - 巴格达', 'Jerusalem': '以色列 - 耶路撒冷',
        'Istanbul': '土耳其 - 伊斯坦布尔', 'London': '英国 - 伦敦', 'Paris': '法国 - 巴黎',
        'Berlin': '德国 - 柏林', 'Rome': '意大利 - 罗马', 'Madrid': '西班牙 - 马德里',
        'Amsterdam': '荷兰 - 阿姆斯特丹', 'Brussels': '比利时 - 布鲁塞尔', 'Vienna': '奥地利 - 维也纳',
        'Zurich': '瑞士 - 苏黎世', 'Geneva': '瑞士 - 日内瓦', 'Stockholm': '瑞典 - 斯德哥尔摩',
        'Oslo': '挪威 - 奥斯陆', 'Copenhagen': '丹麦 - 哥本哈根', 'Helsinki': '芬兰 - 赫尔辛基',
        'Moscow': '俄罗斯 - 莫斯科', 'Kyiv': '乌克兰 - 基辅', 'Warsaw': '波兰 - 华沙',
        'Prague': '捷克 - 布拉格', 'Budapest': '匈牙利 - 布达佩斯', 'Athens': '希腊 - 雅典',
        'New_York': '美国 - 纽约', 'Los_Angeles': '美国 - 洛杉矶', 'Chicago': '美国 - 芝加哥',
        'Houston': '美国 - 休斯敦', 'Denver': '美国 - 丹佛', 'San_Francisco': '美国 - 旧金山',
        'Seattle': '美国 - 西雅图', 'Washington': '美国 - 华盛顿', 'Boston': '美国 - 波士顿',
        'Miami': '美国 - 迈阿密', 'Honolulu': '美国 - 檀香山(夏威夷)', 'Anchorage': '美国 - 安克雷奇(阿拉斯加)',
        'Toronto': '加拿大 - 多伦多', 'Vancouver': '加拿大 - 温哥华', 'Montreal': '加拿大 - 蒙特利尔',
        'Mexico_City': '墨西哥 - 墨西哥城', 'Sao_Paulo': '巴西 - 圣保罗', 'Buenos_Aires': '阿根廷 - 布宜诺斯艾利斯',
        'Santiago': '智利 - 圣地亚哥', 'Lima': '秘鲁 - 利马', 'Bogota': '哥伦比亚 - 波哥大',
        'Sydney': '澳大利亚 - 悉尼', 'Melbourne': '澳大利亚 - 墨尔本', 'Brisbane': '澳大利亚 - 布里斯班',
        'Perth': '澳大利亚 - 珀斯', 'Adelaide': '澳大利亚 - 阿德莱德', 'Auckland': '新西兰 - 奥克兰',
        'Wellington': '新西兰 - 惠灵顿', 'Cairo': '埃及 - 开罗', 'Johannesburg': '南非 - 约翰内斯堡',
        'Cape_Town': '南非 - 开普敦', 'Nairobi': '肯尼亚 - 内罗毕', 'Lagos': '尼日利亚 - 拉各斯',
        'Algiers': '阿尔及利亚 - 阿尔及尔', 'Casablanca': '摩洛哥 - 卡萨布兰卡'
      }
      
      allTimezones.value = tzs.map(tz => {
        try {
          const dtf = new Intl.DateTimeFormat('zh-CN', { timeZone: tz, timeZoneName: 'shortOffset' })
          const offsetRaw = dtf.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || ''
          const offset = offsetRaw.replace('GMT', 'UTC')
          
          let regionStr = '其他'
          let cityStr = tz
          const parts = tz.split('/')
          if (parts.length >= 2) {
            regionStr = regionMap[parts[0]] || parts[0]
            cityStr = cityMap[parts[1]] || parts[parts.length - 1].replace(/_/g, ' ')
          }
          
          return {
            id: tz,
            region: regionStr,
            cityInfo: cityStr,
            offset: offset,
            searchStr: `${regionStr} ${cityStr} ${tz} ${offset}`.toLowerCase()
          }
        } catch(e) {
          return { id: tz, region: '其他', cityInfo: tz, offset: '', searchStr: tz.toLowerCase() }
        }
      })
      
      allTimezones.value.sort((a, b) => {
        if (a.region !== b.region) return a.region.localeCompare(b.region)
        return a.cityInfo.localeCompare(b.cityInfo)
      })
    } catch (e) {
      console.error('Timezone API not supported')
    }
  }

  const getTimezoneLabel = (id: string) => {
    if (!id) return ''
    if (allTimezones.value.length === 0) {
        populateTimezones()
    }
    const match = allTimezones.value.find(t => t.id === id)
    if (match) {
      return `${match.cityInfo} (${match.offset})`
    }
    return id
  }

  const selectTimezoneTab = (tab: string) => {
    activeTimezoneTab.value = tab
    localStorage.setItem('clingy_last_timezone_tab', tab)
  }

  const filteredTimezoneGroups = computed(() => {
    const kw = timezoneSearch.value.toLowerCase()
    const groups = new Map<string, typeof allTimezones.value>()
    
    for (const tz of allTimezones.value) {
      if (!kw || tz.searchStr.includes(kw)) {
        if (!groups.has(tz.region)) {
          groups.set(tz.region, [])
        }
        groups.get(tz.region)!.push(tz)
      }
    }
    
    const result: { region: string, items: typeof allTimezones.value }[] = []
    for (const [region, items] of groups.entries()) {
      result.push({ region, items })
    }
    
    const regionOrder = ['亚洲', '美洲', '欧洲', '大洋洲', '非洲', '太平洋', '大西洋', '印度洋', '南极洲', '其他']
    result.sort((a, b) => {
      let ia = regionOrder.indexOf(a.region)
      let ib = regionOrder.indexOf(b.region)
      if(ia === -1) ia = 99
      if(ib === -1) ib = 99
      if(ia !== ib) return ia - ib
      return a.region.localeCompare(b.region)
    })
    
    return result
  })

  const timezoneTabs = computed(() => {
    return ['本地', ...filteredTimezoneGroups.value.map(g => g.region)]
  })

  const searchResultList = computed(() => {
    const result: typeof allTimezones.value = []
    filteredTimezoneGroups.value.forEach(g => {
      result.push(...g.items)
    })
    return result
  })

  if (allTimezones.value.length === 0) {
    populateTimezones()
  }

  return {
    allTimezones,
    timezoneSearch,
    activeTimezoneTab,
    populateTimezones,
    getTimezoneLabel,
    selectTimezoneTab,
    filteredTimezoneGroups,
    timezoneTabs,
    searchResultList
  }
}
