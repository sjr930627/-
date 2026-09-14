/** 省市区级联（演示用精简数据，覆盖常用省市） */
export interface RegionCascaderOption {
  value: string
  label: string
  children?: RegionCascaderOption[]
}

function districts(...names: string[]): RegionCascaderOption[] {
  return names.map((name) => ({ value: name, label: name }))
}

function city(name: string, districtNames: string[]): RegionCascaderOption {
  return { value: name, label: name, children: districts(...districtNames) }
}

function municipality(name: string, districtNames: string[]): RegionCascaderOption {
  return {
    value: name,
    label: name,
    children: [city(name, districtNames)],
  }
}

export const REGION_CASCADER_OPTIONS: RegionCascaderOption[] = [
  municipality('北京市', [
    '东城区',
    '西城区',
    '朝阳区',
    '海淀区',
    '丰台区',
    '石景山区',
    '通州区',
    '昌平区',
    '大兴区',
    '顺义区',
  ]),
  municipality('上海市', [
    '黄浦区',
    '徐汇区',
    '长宁区',
    '静安区',
    '普陀区',
    '虹口区',
    '杨浦区',
    '浦东新区',
    '闵行区',
    '宝山区',
    '嘉定区',
    '松江区',
  ]),
  municipality('天津市', ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '滨海新区']),
  municipality('重庆市', ['渝中区', '江北区', '南岸区', '沙坪坝区', '九龙坡区', '渝北区', '巴南区']),
  {
    value: '浙江省',
    label: '浙江省',
    children: [
      city('杭州市', ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区']),
      city('宁波市', ['海曙区', '江北区', '镇海区', '北仑区', '鄞州区', '奉化区']),
      city('温州市', ['鹿城区', '龙湾区', '瓯海区', '洞头区']),
      city('嘉兴市', ['南湖区', '秀洲区']),
      city('金华市', ['婺城区', '金东区']),
    ],
  },
  {
    value: '江苏省',
    label: '江苏省',
    children: [
      city('南京市', ['玄武区', '秦淮区', '建邺区', '鼓楼区', '栖霞区', '雨花台区', '江宁区']),
      city('苏州市', ['姑苏区', '虎丘区', '吴中区', '相城区', '吴江区', '工业园区']),
      city('无锡市', ['梁溪区', '锡山区', '惠山区', '滨湖区', '新吴区']),
    ],
  },
  {
    value: '广东省',
    label: '广东省',
    children: [
      city('广州市', ['越秀区', '荔湾区', '海珠区', '天河区', '白云区', '黄埔区', '番禺区', '花都区']),
      city('深圳市', ['罗湖区', '福田区', '南山区', '宝安区', '龙岗区', '龙华区', '坪山区']),
      city('东莞市', ['东城街道', '南城街道', '莞城街道', '万江街道']),
    ],
  },
  {
    value: '四川省',
    label: '四川省',
    children: [
      city('成都市', ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区', '高新西区']),
    ],
  },
  {
    value: '湖北省',
    label: '湖北省',
    children: [
      city('武汉市', ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区']),
    ],
  },
]

export function regionPathFromParts(
  province?: string,
  cityName?: string,
  district?: string,
): string[] | undefined {
  if (!province) return undefined
  const path = [province]
  if (cityName) path.push(cityName)
  if (district) path.push(district)
  return path
}

export function applyRegionPath(
  target: { province?: string; city?: string; district?: string },
  path: string[] | null | undefined,
) {
  target.province = path?.[0] || ''
  target.city = path?.[1] || ''
  target.district = path?.[2] || ''
}

/** 省市区文案，如：浙江省 / 杭州市 / 西湖区 */
export function formatRegionLabel(
  loc: { province?: string; city?: string; district?: string },
  separator = ' / ',
): string {
  return [loc.province, loc.city, loc.district].filter(Boolean).join(separator)
}

/** 完整打卡地址：省市区 + 详细地址 */
export function formatPunchLocationAddress(loc: {
  province?: string
  city?: string
  district?: string
  address?: string
  name?: string
}): string {
  const region = `${loc.province || ''}${loc.city || ''}${loc.district || ''}`
  const detail = (loc.address || '').trim()
  if (region && detail) return `${region}${detail}`
  if (region) return region
  if (detail) return detail
  return loc.name || '—'
}
