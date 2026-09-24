const CATEGORY_LABELS = {
  zh: {
    food: '食品与饮料', pokefood: '宝可梦食品', daily: '日用品', clothes: '服装与配饰',
    outdoor: '户外用品', climbing: '登山用品', grocery: '食品与杂货', ball: '精灵球',
    heal: '宝可梦恢复', status: '异常状态治疗', human: '人用物品', misc: '便利道具',
    held: '宝可梦携带物', accessory: '宝可梦饰品', gimmick: '对战装置', special: '特殊物品', treasure: '贵重物品',
  },
  en: {
    food: 'Food & drinks', pokefood: 'Pokémon food', daily: 'Daily supplies', clothes: 'Clothing & accessories',
    outdoor: 'Outdoor gear', climbing: 'Climbing gear', grocery: 'Food & groceries', ball: 'Poké Balls',
    heal: 'Pokémon healing', status: 'Status cures', human: 'Human supplies', misc: 'Utility',
    held: 'Pokémon held items', accessory: 'Pokémon accessories', gimmick: 'Battle devices', special: 'Special', treasure: 'Valuables',
  },
}

const ZH_BASE = {
  'Áo khoác gió': '防风外套', 'Áo thun trainer': '训练家T恤', 'Quần trekking': '徒步长裤', 'Áo mưa trùm': '雨披',
  'Mũ lưỡi trai': '鸭舌帽', 'Găng tay': '手套', 'Khăn choàng': '围巾', 'Giày đi bộ': '徒步鞋', 'Tất dày': '厚袜', 'Áo len': '毛衣',
  'Lều': '帐篷', 'Túi ngủ': '睡袋', 'Bếp dã ngoại': '露营炉', 'Đèn pin': '手电筒', 'Balo': '背包', 'Bình nước': '水壶',
  'Dao đa năng': '多功能刀', 'Tấm trải cách nhiệt': '隔热垫', 'Bộ nồi dã ngoại': '露营锅具', 'Võng du lịch': '旅行吊床',
  'Dây leo núi': '登山绳', 'Móc khoá carabiner': '登山扣', 'Đai bảo hộ': '安全带', 'Mũ bảo hộ': '安全头盔',
  'Giày bám đá': '攀岩鞋', 'Phấn bám tay': '防滑粉', 'Rìu băng': '冰镐', 'Đinh giày băng': '冰爪',
  'Gạo': '大米', 'Mì gói': '方便面', 'Đồ hộp': '罐头', 'Bánh mì': '面包', 'Trứng': '鸡蛋', 'Berry tươi': '新鲜树果',
  'Trà gói': '袋装茶', 'Sữa Miltank': '大奶罐鲜奶', 'Muối - gia vị': '盐与调味料', 'Thức ăn Pokémon': '宝可梦食品',
  'Snack Pokémon': '宝可梦零食', 'Xà phòng': '肥皂', 'Khăn tắm': '毛巾', 'Bàn chải - kem đánh răng': '牙刷牙膏旅行装',
  'Pin tiểu': '电池', 'Hộp diêm - bật lửa': '火柴与打火机', 'Kim chỉ': '针线包', 'Túi sơ cứu (người)': '人用急救包', 'Ô gấp': '折叠伞',
}

const ZH_DESC = {
  'Chắn gió đi đường dài.': '适合长途旅行，能够挡风。', 'Cotton thoáng, in hoạ tiết Pokémon.': '透气棉料，印有宝可梦图案。',
  'Vải bền, nhiều túi.': '耐磨面料，多口袋设计。', 'Trùm cả balo.': '可以连背包一起遮住。', 'Kiểu dáng trainer kinh điển.': '经典训练家款式。',
  'Ấm tay mùa lạnh.': '寒冷天气里保持双手温暖。', 'Vừa ấm vừa có dáng.': '保暖又好搭配。', 'Đế bám tốt, đi cả ngày không mỏi.': '抓地力好，适合全天步行。',
  'Bộ 2 đôi.': '两双装。', 'Đan tay, ấm thật sự.': '手工针织，保暖扎实。', 'Chống mưa, dựng nhanh.': '防雨，搭建迅速。',
  'Cuộn gọn sau balo.': '可卷起固定在背包后方。', 'Nấu bữa nóng giữa đường.': '旅途中也能做一顿热饭。', 'Pin bền, chống nước nhẹ.': '续航持久，具备基础防水。',
  'Khung trợ lực, đai hông.': '带支撑架与腰带。', 'Đi đường xa không thể thiếu.': '长途旅行必备用品。', 'Từ mở hộp tới cắt dây.': '开罐、割绳等多用途。',
  'Ngủ đất không thấm lưng.': '隔绝地面湿冷。', 'Lồng gọn vào nhau.': '可套叠收纳。', 'Mắc giữa hai thân cây.': '可系在两棵树之间。',
  'Chịu tải chuẩn kiểm định.': '承重达到检验标准。', 'Bán theo chiếc.': '按个出售。', 'Ôm hông, chia lực tốt.': '贴合腰部并均匀分散受力。',
  'Đá rơi không đùa được.': '为落石环境提供头部保护。', 'Mũi cứng, đế ma sát cao.': '鞋头坚固，鞋底摩擦力高。', 'Túi phấn kèm hộp.': '附粉袋与收纳盒。',
  'Cho vách băng và dốc tuyết.': '适用于冰壁与雪坡。', 'Gắn vào giày đi băng.': '安装在鞋底用于冰面行走。',
  'Một khẩu phần đã nấu từ gạo địa phương.': '当地大米，可煮成一份正餐。', 'Cứu đói kinh điển.': '经典应急充饥食品。', 'Để được lâu.': '便于长期保存。',
  'Ra lò buổi sáng.': '清晨新鲜出炉。', 'Một khẩu phần trứng trại địa phương.': '当地农场鸡蛋，可做成一份餐食。', 'Người ăn được, Pokémon càng thích.': '人可以吃，宝可梦更喜欢。',
  'Ấm bụng buổi tối.': '晚上喝一杯很暖胃。', 'Nguồn Johto chính hiệu.': '正宗城都来源。', 'Bếp dã ngoại cần đủ vị.': '露营做饭常用调味料。',
  'Khẩu phần cân bằng.': '营养均衡的宝可梦口粮。', 'Thưởng khi ngoan.': '适合作为乖巧表现的奖励。', 'Sạch bụi đường.': '洗去旅途灰尘。',
  'Khô nhanh.': '速干材质。', 'Bộ du lịch.': '旅行装。', 'Cho đèn và radio.': '可用于手电筒和收音机。', 'Lửa là sự sống.': '野外生火的基础用品。',
  'Vá đồ giữa đường.': '旅途中可用于缝补衣物。', 'Băng gạc, thuốc đỏ — giảm 18 thương tích một bộ phận.': '包含绷带与消毒用品，可降低一个部位18点伤势。',
  'Gọn trong balo.': '折叠后便于放进背包。',
}

const ZH_VARIANT = {
  'xanh rêu': '苔绿色', 'xám tro': '灰色', 'đỏ gạch': '砖红色', 'đen': '黑色', 'trắng': '白色', 'xanh biển': '海蓝色', 'vàng': '黄色',
  'be': '米色', 'xám': '灰色', 'xanh đen': '深蓝色', 'xanh': '蓝色', 'trong suốt': '透明', 'đỏ trắng': '红白色', 'xanh lam': '蓝色', 'kaki': '卡其色',
  'da': '皮革', 'len': '羊毛', 'chống nước': '防水', 'len đỏ': '红色羊毛', 'len xám': '灰色羊毛', 'lụa xanh': '蓝色丝绸', 'nâu': '棕色', 'xám xanh': '蓝灰色',
  'kẻ sọc': '条纹', 'kem': '奶油色', '2 người': '2人', '4 người': '4人', '3 mùa': '三季', 'mùa đông': '冬季', 'gas mini': '迷你燃气', 'củi gấp': '折叠柴炉',
  'cầm tay': '手持式', 'đội đầu': '头戴式', 'giữ nhiệt': '保温', 'gấp gọn': '折叠式', '8 món': '8件套', '12 món': '12件套', 'đơn': '单人', 'có màn': '带蚊帐',
  '30m': '30米', '50m': '50米', 'thường': '普通', 'khoá tự động': '自动锁', 'cam': '橙色', '10 mấu': '10齿', '12 mấu': '12齿',
  '1kg': '1公斤', '5kg': '5公斤', 'bò': '牛肉', 'gà': '鸡肉', 'chay': '素食', 'cá': '鱼肉', 'thịt hầm': '炖肉', 'đậu': '豆类', 'ổ thường': '普通', 'nguyên cám': '全麦',
  'vỉ 6': '6枚装', 'vỉ 10': '10枚装', 'xanh': '绿色', 'hoa cúc': '菊花', 'tươi': '鲜奶', 'tiệt trùng': '灭菌', 'muối': '盐', 'tiêu': '胡椒', 'bột nêm': '调味粉',
  'túi thường': '普通袋', 'túi lớn': '大袋', 'cao cấp': '高级', 'giòn': '酥脆', 'mềm': '软质', 'bánh': '固体', 'nước': '液体', 'nhỏ': '小号', 'lớn': '大号',
  'AA vỉ 4': 'AA 4节装', 'AAA vỉ 4': 'AAA 4节装', 'diêm': '火柴', 'bật lửa': '打火机', 'chấm bi': '波点',
}

const ZH_BRAND_BLURB = {
  'hàng hiệu Saffron, tiền nào của nấy': '金黄市名牌，品质与价格相称', 'đồ kỹ thuật Rustboro, bền nổi tiếng': '卡那兹技术产品，以耐用闻名',
  'tập đoàn Galar, mẫu mã bóng bẩy': '伽勒尔集团产品，外观精致', 'đồ biển đảo Hoenn': '丰缘海岛用品', 'vải ấm xứ tuyết Kalos': '卡洛斯雪乡保暖织物',
  'đồ đi biển Galar': '伽勒尔海滨用品', 'nhà buôn sa mạc Paldea': '帕底亚沙漠商行', 'bình dân, dùng được': '平价实用', 'xưởng gia đình, mộc mạc': '家庭工坊，朴实耐用',
  'đồ chịu nhiệt vùng núi lửa': '火山地区耐热用品', 'thủ công Johto': '城都手工制品', 'hàng thanh lý, hên xui': '清仓货，品质看运气',
}

const STATIC_ZH = {
  pokeball: ['精灵球', '基础捕捉用精灵球。'], greatball: ['超级球', '比精灵球拥有更高的捕获率。'], ultraball: ['高级球', '捕获率较高，适合较强的宝可梦。'],
  potion: ['伤药', '为宝可梦回复20 HP。'], superpotion: ['好伤药', '为宝可梦回复60 HP。'], hyperpotion: ['厉害伤药', '为宝可梦回复120 HP。'],
  fullrestore: ['全复药', '完全回复HP并治愈主要异常状态。'], revive: ['活力碎片', '让濒死宝可梦恢复一半HP。'], antidote: ['解毒药', '治愈中毒。'],
  paralyzeheal: ['解麻药', '治愈麻痹。'], awakening: ['解眠药', '唤醒睡眠中的宝可梦。'], burnheal: ['灼伤药', '治愈灼伤。'], iceheal: ['解冻药', '治愈冰冻。'], fullheal: ['万灵药', '治愈主要异常状态。'],
  bandage: ['绷带', '为人类角色处理轻伤。'], medkit: ['急救包', '为人类角色处理中等伤势。'], painkillers: ['止痛药', '受重伤时帮助忍耐疼痛。'],
  escaperope: ['离洞绳', '快速离开洞窟。'], repel: ['除虫喷雾', '一段时间内驱赶较弱的野生宝可梦。'], freshwater: ['美味之水', '饮料，可供人饮用或为宝可梦回复HP。'],
  ricemeal: ['热饭套餐', '供人食用的一顿正餐。'], sandwich: ['三明治', '适合旅途中快速食用。'], lemonade: ['柠檬水', '清爽解渴。'], instantnoodle: ['方便面', '便宜轻便的应急食品。'],
  driedration: ['野外口粮', '适合长途旅行，易于保存。'], pokefood: ['宝可梦食品（袋装）', '宝可梦标准口粮。'], 'pokefood-premium': ['高级宝可梦食品', '营养更完整的宝可梦口粮。'], pokepuff: ['宝可梦泡芙', '给宝可梦的甜点。'],
  raincoat: ['雨衣', '应对旅途中的突然降雨。'], flashlight: ['手电筒', '适合洞窟和夜路。'], sleepingbag: ['睡袋', '户外露营时使用。'], phonecard: ['电话卡', '可用于从宝可梦中心联系家里。'],
  firstaidkit: ['人用急救包', '为人类角色提供轻度急救。'], mapbook: ['地区地图（纸质）', '当地纸质折叠地图。'], repelspray: ['驱虫喷雾', '露营时驱赶普通昆虫；对宝可梦无效。'],
}

const SHOP_UI = {
  zh: {
    hide: '✕ 隐藏（暂不决定）', hideTitle: '暂时收起价目表，不做决定；剧情不会继续，可再次打开商店。', wallet: '你的钱包', items: '件商品', size: '规模', bargained: '已砍价',
    you: '你', shopkeeper: '店主', askPlaceholder: '询问商品 / 砍价 / 和店主聊天…', ask: '询问', gift: '🎁 店主赠送：',
    introducedPrefix: '✨ 店主刚刚介绍了', introducedSuffix: '件商品。', showAll: '正在筛选 — 显示全部', onlyRecommended: '只显示推荐商品',
    subtotal: '小计', total: '合计', insufficient: '（余额不足！）', buyContinue: '购买并继续故事', noBuyContinue: '不购买并继续',
    noBuyTitle: '确认不购买任何东西，并让故事继续描写你离开商店。', footer: '“隐藏”只收起商店，剧情暂停且可重新打开；“不购买并继续”会确认离店并继续剧情。',
    aiError: '调用 AI 失败', shop: '商店',
  },
  en: {
    hide: '✕ Hide (undecided)', hideTitle: 'Hide the price list without deciding; the story stays paused and the shop can be reopened.', wallet: 'Wallet', items: 'items', size: 'size', bargained: 'bargained',
    you: 'You', shopkeeper: 'Shopkeeper', askPlaceholder: 'Ask about stock / bargain / chat with the shopkeeper…', ask: 'Ask', gift: '🎁 Shopkeeper gift:',
    introducedPrefix: '✨ The shopkeeper just recommended', introducedSuffix: 'items.', showAll: 'Filtered — show all', onlyRecommended: 'Show recommended only',
    subtotal: 'Subtotal', total: 'Total', insufficient: '(not enough money!)', buyContinue: 'Buy & continue story', noBuyContinue: 'Leave without buying',
    noBuyTitle: 'Confirm buying nothing and continue the story as you leave the shop.', footer: '“Hide” only closes the shop temporarily; “Leave without buying” confirms the decision and continues the story.',
    aiError: 'AI call failed', shop: 'Shop',
  },
}

export function shopNumberLocale(language) {
  if (language === 'zh') return 'zh-CN'
  if (language === 'en') return 'en-US'
  return 'vi-VN'
}

export function shopUi(key, language, viFallback = '') {
  return SHOP_UI[language]?.[key] ?? viFallback
}

export function shopCategoryLabel(category, language, viFallback = category) {
  return CATEGORY_LABELS[language]?.[category] ?? viFallback ?? category
}

export function shopSizeLabel(value, language) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (language === 'zh') {
    if (/^(?:nhỏ|small|bé|小型|小)$/i.test(raw)) return '小型'
    if (/^(?:lớn|to|big|large|大型|大)$/i.test(raw)) return '大型'
    if (/^(?:vừa|medium|中型|中)$/i.test(raw)) return '中型'
  }
  if (language === 'en') {
    if (/^(?:nhỏ|small|bé|小型|小)$/i.test(raw)) return 'small'
    if (/^(?:lớn|to|big|large|大型|大)$/i.test(raw)) return 'large'
    if (/^(?:vừa|medium|中型|中)$/i.test(raw)) return 'medium'
  }
  return raw
}

export function localizeShopItem(item, language) {
  if (!item || language !== 'zh') return { name: item?.name ?? '', desc: item?.desc ?? '' }
  if (item.generatedShopItem && item.shopBase) {
    const base = ZH_BASE[item.shopBase] ?? item.shopBase
    const variant = item.shopVariant ? (ZH_VARIANT[item.shopVariant] ?? item.shopVariant) : ''
    const size = item.shopSize ?? ''
    const suffix = [variant, size].filter(Boolean).join('，')
    const name = `${item.shopBrand ?? ''} ${base}${suffix ? `（${suffix}）` : ''}`.trim()
    const desc = ZH_DESC[item.shopSourceDesc] ?? item.shopSourceDesc ?? item.desc ?? ''
    const brand = ZH_BRAND_BLURB[item.shopBrandBlurb] ?? item.shopBrandBlurb ?? ''
    return { name, desc: [desc, brand].filter(Boolean).join(' — ') }
  }
  const hit = STATIC_ZH[item.id]
  if (hit) return { name: hit[0], desc: hit[1] }
  return { name: item.name ?? '', desc: item.desc ?? '' }
}
