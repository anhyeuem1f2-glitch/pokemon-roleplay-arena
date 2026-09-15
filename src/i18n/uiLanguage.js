import { hasZhStaticTranslation, translateZhStatic, ZH_STATIC_CATALOG } from './zhStaticCatalog.js'
import { EN_UI_EXTRAS, ZH_UI_EXTRAS } from './uiStaticExtras.js'

export const UI_LANGUAGE_STORAGE_KEY = 'trainer-arena:ui-language'
export const DEFAULT_UI_LANGUAGE = 'vi'

export const UI_LANGUAGES = Object.freeze([
  { key: 'vi', label: 'Tiếng Việt', short: 'VI', htmlLang: 'vi' },
  { key: 'en', label: 'English', short: 'EN', htmlLang: 'en' },
  { key: 'zh', label: '简体中文', short: '中文', htmlLang: 'zh-CN' },
])

export function normalizeUiLanguage(value) {
  return UI_LANGUAGES.some((entry) => entry.key === value) ? value : DEFAULT_UI_LANGUAGE
}

const EN = {
  ...EN_UI_EXTRAS,
  'Thế giới nhập vai của huấn luyện viên Pokémon': 'A Pokémon Trainer roleplay world',
  'Bỏ qua intro': 'Skip intro',
  'Đang phát intro...': 'Playing intro...',
  'Intro vẫn đang chạy — màn hình chính đang hiện ra dần.': 'The intro is still playing — the main screen is fading in.',
  'Sẵn sàng bắt đầu hành trình.': 'Ready to begin your journey.',
  '▶ Tiếp tục hành trình': '▶ Continue journey',
  'Bắt đầu một hành trình mới': 'Start a new journey',
  'Cài đặt API': 'API Settings',
  'API đã sẵn sàng': 'API ready',
  'Chưa cấu hình API': 'API not configured',
  'Lưu truyện đã sẵn': 'Saved story available',
  'Màn khởi đầu mới': 'Fresh start',
  'Mẹo: mở “Cài đặt API” trước khi bắt đầu để kiểm tra model và kết nối.': 'Tip: open “API Settings” before starting to test the model and connection.',
  'Đang viết khởi đầu cho hành trình của bạn...': 'Writing the opening of your journey...',
  'AI đang dựng bối cảnh mở màn — chờ một chút nhé.': 'AI is building the opening scene — please wait a moment.',
  'Chế độ': 'Mode', 'Hồ sơ': 'Profile', 'Thân phận': 'Identity', 'Tính cách': 'Traits', 'Sandbox': 'Sandbox', 'Xuất thân': 'Origin', 'Tông truyện': 'Story tone', 'Mở đầu': 'Opening',
  'Chọn luật vận hành cho cả hành trình': 'Choose the rules for the whole journey',
  'Ảnh đại diện (tuỳ chọn)': 'Avatar (optional)', 'Tên nhân vật': 'Character name', 'Giới tính': 'Gender', 'Tuổi': 'Age', 'Đặc điểm ngoại hình (tuỳ chọn)': 'Appearance details (optional)',
  'Về Pokémon khởi đầu': 'About your starter Pokémon', 'Tiền khởi đầu': 'Starting money', 'Loài': 'Species', 'Hình thái / Form': 'Form', 'Kích thước': 'Size', 'Vật phẩm khởi đầu': 'Starting items',
  'Ngày bắt đầu (lịch trong truyện)': 'Starting date (in-story calendar)', 'Ngày': 'Day', 'Tháng': 'Month', 'Năm': 'Year',
  'Chọn cách câu chuyện mở màn — mỗi lựa chọn có mô tả đầy đủ bên dưới.': 'Choose how the story begins — each option is described below.',
  '🎲 Để AI tự nghĩ': '🎲 Let AI decide', '✎ Tự viết mở đầu riêng': '✎ Write a custom opening',
  'Chọn tất cả': 'Select all', 'Auto / Xoá chọn': 'Auto / Clear', 'Huỷ sửa': 'Cancel edit', 'Sửa': 'Edit', '+ Thêm': '+ Add', '+ Thêm Pokémon': '+ Add Pokémon',
  '🎲 Tự động': '🎲 Auto', '🎲 Tự động theo tỉ lệ canon': '🎲 Auto by canon ratio', '— Chọn —': '— Select —', 'Chọn loài trước': 'Select species first', 'Không bắt buộc': 'Optional', 'Không cầm': 'None',
  '31 tất cả': 'All 31', '252 tất cả · Sandbox': 'All 252 · Sandbox', '0 tất cả': 'All 0', 'Tự nhập': 'Custom', '🎲 Random 0–31': '🎲 Random 0–31',
  'Chiêu thức Sandbox · full learnset': 'Sandbox moves · full learnset', 'Đang tải learnset đầy đủ… Có thể tiếp tục cấu hình; danh sách sẽ tự hiện khi dữ liệu sẵn sàng.': 'Loading the full learnset… You can keep configuring; the list will appear when ready.',
  'Không tìm thấy learnset cho form này. Nếu form kế thừa loài gốc, hãy thử chọn form mặc định.': 'No learnset found for this form. If it inherits from the base species, try the default form.',
  'Không có chiêu khớp tìm kiếm.': 'No moves match your search.', 'Tìm chiêu, hệ hoặc nguồn học…': 'Search moves, types, or learn sources…',
  'Friendship 0–255': 'Friendship 0–255', 'Biệt danh': 'Nickname', 'BIỆT DANH / NICKNAME': 'NICKNAME',
  'Cài đặt': 'Settings', 'Quay lại': 'Back', 'Lưu': 'Save', 'Huỷ': 'Cancel', 'Xoá': 'Delete', 'Đóng': 'Close', 'Xác nhận': 'Confirm', 'Tìm kiếm': 'Search',
  '👤 Nhân vật': '👤 Character', '🗺 Bản đồ & menu': '🗺 Map & menu', 'Nhân vật': 'Character', 'Bản đồ & menu': 'Map & menu',
  'Người chơi': 'Player', '(chưa đặt tên)': '(unnamed)', 'Xoá lịch sử chat': 'Clear chat history', 'Câu chuyện chưa bắt đầu.': 'The story has not started yet.',
  'Lựa chọn hành động': 'Action choices', 'BƯỚC TIẾP THEO': 'NEXT STEP', 'Bấm để điền · vẫn sửa được trước khi gửi': 'Click to fill · you can still edit before sending', '↻ Gợi ý lại': '↻ Regenerate', '↻ Đang tạo…': '↻ Generating…',
  'Đang đọc tình huống để chuẩn bị gợi ý…': 'Reading the situation to prepare suggestions…', 'Đưa hành động này vào ô nhập': 'Put this action into the input box',
  'Túi đồ': 'Bag', 'Đội hình': 'Party', 'Pokédex': 'Pokédex', 'Nhật ký': 'Journal', 'Bản đồ': 'Map', 'Trang bị': 'Equipment', 'Trang sức / phụ kiện Pokémon': 'Pokémon accessories',
  'Thức ăn Pokémon': 'Pokémon Food', 'Hồi phục Pokémon': 'Pokémon Recovery', 'Đồ dùng sinh hoạt': 'Daily Supplies', 'Tiện ích': 'Utility', 'Trang bị Pokémon': 'Pokémon Held Items',
  'Thông tin': 'Info', 'Chỉ số': 'Stats', 'Chiêu thức': 'Moves', 'Chỉ số thực tế': 'Battle stats', 'IV — Chỉ số bẩm sinh': 'IV — Innate values', 'EV — Điểm rèn luyện': 'EV — Effort values', 'Tổng EV': 'Total EV',
  'Tên loài': 'Species', 'Hệ': 'Type', 'Nature': 'Nature', 'Ability': 'Ability', 'Hình thái': 'Form', 'Shiny': 'Shiny', 'Đực': 'Male', 'Cái': 'Female', 'Vô giới tính': 'Genderless',
  'Trung tâm Pokémon': 'Pokémon Center', 'Cửa hàng': 'Shop', 'Mua': 'Buy', 'Bán': 'Sell', 'Số lượng': 'Quantity', 'Giá': 'Price', 'Tiền': 'Money',
  'Trận đấu': 'Battle', 'Tấn công': 'Attack', 'Đổi Pokémon': 'Switch Pokémon', 'Vật phẩm': 'Item', 'Chạy': 'Run', 'Terastal': 'Terastalize', 'Chọn hệ Tera': 'Choose Tera Type',
  'Đấu đôi 2v2': 'Double Battle 2v2', 'Thắng': 'Victory', 'Thua': 'Defeat', 'Chạy thoát': 'Escaped', 'Lượt': 'Turn',
  'Cài đặt API và mô hình': 'API & Model Settings', 'API chính': 'Main API', 'API phụ': 'Auxiliary API', 'Model': 'Model', 'Kiểm tra kết nối': 'Test connection', 'Đã kết nối': 'Connected',
  'Trò chuyện & bàn phím': 'Chat & keyboard', 'Tự động cuộn xuống khi có tin mới': 'Auto-scroll when new content arrives', 'Enter = Gửi': 'Enter = Send', 'Enter = Xuống dòng': 'Enter = New line',
  'Developer · Debug model': 'Developer · Model debug', 'Bật LLM Debug Modal': 'Enable LLM Debug Modal', '🐞 LLM Debug': '🐞 LLM Debug',
  'Ngôn ngữ': 'Language', 'Tiếng Việt': 'Vietnamese', 'Tiếng Anh': 'English', 'Tiếng Trung': 'Chinese',
  'Sẵn sàng': 'Ready', 'Đang tải…': 'Loading…', 'Đang tải': 'Loading', 'Không có dữ liệu': 'No data', 'Chưa có': 'None yet', 'Không': 'No', 'Có': 'Yes',
  'Mở': 'Open', 'Tháo': 'Unequip', 'Đeo': 'Equip', 'Dùng': 'Use', 'Tạo': 'Create', 'Thêm': 'Add', 'Xoá chọn': 'Clear selection', 'Tự động': 'Auto',
  'Bạn là ai?': 'Who are you?', 'Thân phận — xuất phát điểm xã hội của bạn': 'Identity — your social starting point', 'Tính cách & năng lực — nhân vật của bạn là người thế nào?': 'Traits & powers — who is your character?', 'Sandbox — chốt tài nguyên & Pokémon khởi đầu': 'Sandbox — configure starting resources & Pokémon', 'Quê nhà & thời điểm bắt đầu': 'Home region & starting time', 'Thể loại — câu chuyện mang hương vị nào?': 'Genre — what kind of story is this?', 'Câu chuyện bắt đầu thế nào?': 'How does the story begin?',
  '⚡ Nạp nhân vật đã lưu': '⚡ Load saved character', 'Xoá hồ sơ này': 'Delete this profile', "Để trống = 'Nhà Huấn Luyện'": "Leave blank = 'Trainer'", 'VD 16': 'e.g. 16',
  'TỰ TẠO': 'CUSTOM', '✎ Thân phận riêng của bạn': '✎ Custom identity', '⚙ App nhận diện cơ chế:': '⚙ Mechanics detected by app:', '⚙ Luật năng lực theo chế độ': '⚙ Power rules by mode',
  'Chốt state khởi đầu tự do. Những gì đặt ở đây được ghi thẳng vào save trước khi AI viết mở đầu; sau đó hành trình vận hành như Anime.': 'Freely configure your starting state. Everything here is written into the save before AI writes the opening; after that, the journey follows Anime rules.',
  'Thành phố / khu xuất thân trong': 'City / home area in', 'Chế độ đã chọn:': 'Selected mode:', 'Tag văn phong (chọn tự do — có thể phối nhiều tag)': 'Style tags (free selection — combine multiple)', 'TỔNG KẾT NHÂN VẬT': 'CHARACTER SUMMARY',
  '⚖ Thực tế': '⚖ Realistic', 'Luật cứng, hậu quả thật': 'Hard rules, real consequences', '🌸 Anime': '🌸 Anime', 'Tình bạn và cao trào': 'Friendship and dramatic peaks', '🧰 Sandbox': '🧰 Sandbox', 'Tự do thiết lập, chơi theo luật Anime': 'Free setup, play under Anime rules', 'Thực tế': 'Realistic',
  'Nam': 'Male', 'Nữ': 'Female', 'Khác / không tiết lộ': 'Other / undisclosed', 'Nhà Huấn Luyện': 'Trainer',
  'Phiêu lưu': 'Adventure', 'Sảng văn': 'Power fantasy', 'Hài hước': 'Comedy', 'Đời thường': 'Slice of life', 'Học đường': 'School', 'Trinh thám / bí ẩn': 'Mystery', 'Kinh dị': 'Horror', 'Bi kịch': 'Tragedy', 'Chính kịch': 'Drama', 'Âm mưu / tổ chức ngầm': 'Conspiracy / underground', 'Thi đấu / giải đấu': 'Tournament', 'Sinh tồn': 'Survival', 'Chăm sóc / nuôi dưỡng': 'Nurture', 'Gây dựng thế lực': 'Build a faction',
  'Kinh tế, pháp luật, sinh thái và tiến trình đều có trọng lượng. Chỉ dùng một năng lực dựng sẵn; không có năng lực tự tạo hay cheat. Đây là chế độ duy nhất cho phép trao đổi Pokémon.': 'Economy, law, ecology, and progression all matter. Only one built-in power is allowed; no custom powers or cheats. This is the only mode that allows Pokémon trading.',
  'Sandbox như anime: ý chí, kỳ tích và huyền thoại có thể đi theo cách người chơi muốn. Không có trao đổi dữ liệu giữa người chơi.': 'Anime-style sandbox: willpower, miracles, and legends can follow the player’s chosen direction. No cross-player data trading.',
  'Tự do cấu hình lúc tạo nhân vật: Pokémon khởi đầu, level, tiền, vật phẩm và sức mạnh. Sau khi bắt đầu, thế giới vận hành theo luật Anime; không có trao đổi dữ liệu giữa người chơi.': 'Freely configure starter Pokémon, levels, money, items, and powers during character creation. After starting, the world follows Anime rules; no cross-player data trading.',
  'Chế độ quyết định luật dữ liệu, tiến trình và những gì chính văn được phép làm. Lựa chọn này được khoá theo hành trình để save và trao đổi không bị lách luật.': 'Mode determines data rules, progression, and what the story is allowed to establish. The choice is locked to the journey so saves and trading cannot bypass the rules.',
  'Điền thông tin cơ bản. Để trống phần nào cũng được — AI sẽ tự lo phần đó. Luật thế giới đã được chốt ở bước Chế độ; preset nhân vật bên dưới không thể đổi lựa chọn ấy.': 'Fill in the basic information. You may leave any field blank — AI will handle it. World rules were fixed in the Mode step; saved character presets cannot override that choice.',
  'Thân phận quyết định cách thế giới nhìn bạn và những biến cố tự tìm tới bạn (Đạo diễn tình huống dùng đúng pool của thân phận này). Chọn một — hoặc tự viết ở cuối danh sách.': 'Identity determines how the world sees you and which events naturally find you. Choose one, or write a custom identity at the end.',
  'Quê nhà định hình giọng nói, mối quan hệ đầu đời — và tổ chức phản diện nào lảng vảng trong tin tức địa phương. Mỗi vùng một khí chất riêng.': 'Your home region shapes your accent, early relationships, and which villainous groups appear in local news. Every region has its own character.',
  'Mô tả cảnh mở màn bạn muốn — AI viết dựa theo ý này.': 'Describe the opening scene you want — AI will write from it.',
  // Đợt 123: critical setup choices are local so they never depend on Google availability.
  'Tiếp tục →': 'Continue →', '← Quay lại': '← Back',
  'Khởi đầu mở': 'Open start', 'Dân lao động': 'Working class', 'Gia tộc & quyền quý': 'Clans & nobility', 'Giới thi đấu': 'Competitive scene', 'Giới xám': 'Underworld', 'Thực thi pháp luật': 'Law enforcement', 'Kiểm lâm & tự nhiên': 'Rangers & nature', 'Học thuật': 'Academia', 'Y tế': 'Healthcare', 'Truyền thông': 'Media', 'Biểu diễn': 'Performance', 'Thương nghiệp': 'Commerce', 'Nhân giống': 'Breeding', 'Khác': 'Other',
  'Tính cách (chọn bao nhiêu nét tuỳ thích)': 'Personality (choose as many traits as you like)',
  'Siêu năng lực (tuỳ chọn)': 'Special power (optional)',
  'Chọn vài nét tính cách để AI khắc hoạ ĐÚNG nhân vật của bạn (không chọn thì AI dễ mặc định thành lạnh lùng, thực dụng). Có thể chọn nhiều nét.': 'Choose a few personality traits so the AI portrays your character accurately. You may select multiple traits.',
  'Ấm áp, tốt bụng': 'Warm, kind', 'Vui vẻ, lạc quan': 'Cheerful, optimistic', 'Dũng cảm, gan dạ': 'Brave, fearless', 'Hiền lành, nhẹ nhàng': 'Gentle, soft-spoken', 'Tò mò, ham học hỏi': 'Curious, eager to learn', 'Trung thành, nghĩa khí': 'Loyal, honorable', 'Bướng bỉnh, kiên định': 'Stubborn, steadfast', 'Tinh nghịch, hài hước': 'Playful, humorous', 'Nhút nhát, kín đáo': 'Shy, reserved', 'Kiêu hãnh, tự tin': 'Proud, confident', 'Điềm tĩnh, chín chắn': 'Calm, mature', 'Nhiệt huyết, bốc đồng': 'Passionate, impulsive', 'Ranh mãnh, mưu mẹo': 'Cunning, crafty', 'Lạnh lùng, ít nói': 'Cold, quiet', 'Tham vọng, quyết đoán': 'Ambitious, decisive', 'Giàu lòng trắc ẩn': 'Compassionate',
  'Không có (người thường)': 'None (ordinary person)', 'Aura / Nội lực': 'Aura / Inner power', 'Psychic (Siêu năng lực)': 'Psychic', 'Thấu hiểu Pokémon': 'Pokémon empathy', 'Linh cảm / Tiên tri': 'Intuition / Foresight', 'Cảm ứng nguyên tố': 'Elemental affinity', 'Tự mô tả…': 'Custom…',
  'Siêu năng lực được thể hiện có chừng mực, có giới hạn và cái giá của nó — không biến nhân vật thành bất khả chiến bại.': 'Special powers are portrayed with restraint, limits, and consequences — they do not make the character invincible.',
  'Tân binh tự do': 'Free-roaming rookie', 'Làm thuê nông trại Pokémon': 'Pokémon farmhand', 'Dân chài': 'Fisher family', 'Con nhà thợ mỏ': "Miner's child", 'Trẻ mồ côi tự lập': 'Self-reliant orphan',
  'Con cháu đại gia tộc': 'Heir of a great clan', 'Hậu duệ gia tộc sa sút': 'Heir of a fallen clan', 'Con của trainer nổi tiếng': 'Child of a famous Trainer',
  'Giang hồ đường phố': 'Street underworld local', 'Chân chạy vặt cho tổ chức': 'Organization runner', 'Cựu thành viên tổ chức đang rửa tay': 'Former organization member going clean', 'Con nhà buôn lậu Pokémon': 'Child of Pokémon smugglers', 'Chỉ điểm hai mang': 'Double informant', 'Cựu phụ việc săn trộm hoàn lương': 'Reformed former poaching aide',
  'Học viên cảnh sát': 'Police academy trainee', 'Con nhà cảnh sát': 'Police family child', 'Trợ lý tập sự Cảnh sát Quốc tế': 'International Police trainee aide',
  'Kiểm lâm tập sự': 'Ranger trainee', 'Phụ việc khu bảo tồn': 'Reserve assistant', 'Trợ lý nghiên cứu': 'Research assistant', 'Học việc khảo cổ': 'Archaeology apprentice',
  'Thực tập sinh trung tâm Pokémon': 'Pokémon Center intern', 'Cứu hộ dã chiến': 'Field rescue medic', 'Đệ tử gym': 'Gym apprentice', 'Thí sinh liên đoàn bỏ dở': 'League dropout',
  'Phóng viên tập sự': 'Trainee reporter', 'Nhiếp ảnh gia hoang dã': 'Wildlife photographer', 'Nghệ sĩ đường phố cùng Pokémon': 'Pokémon street performer', 'Con nhà thương lái rong': 'Child of traveling merchants', 'Con nhà trại nhân giống': 'Breeder-family child',

}

const ZH = {
  'Thế giới nhập vai của huấn luyện viên Pokémon': '宝可梦训练家角色扮演世界',
  'Bỏ qua intro': '跳过开场', 'Đang phát intro...': '正在播放开场…', 'Intro vẫn đang chạy — màn hình chính đang hiện ra dần.': '开场仍在播放——主界面正在渐显。', 'Sẵn sàng bắt đầu hành trình.': '准备开始旅程。',
  '▶ Tiếp tục hành trình': '▶ 继续旅程', 'Bắt đầu một hành trình mới': '开始新的旅程', 'Cài đặt API': 'API 设置', 'API đã sẵn sàng': 'API 已就绪', 'Chưa cấu hình API': '尚未配置 API', 'Lưu truyện đã sẵn': '已有存档剧情', 'Màn khởi đầu mới': '全新开局',
  'Mẹo: mở “Cài đặt API” trước khi bắt đầu để kiểm tra model và kết nối.': '提示：开始前先打开“API 设置”，测试模型与连接。',
  'Đang viết khởi đầu cho hành trình của bạn...': '正在为你的旅程编写开场…', 'AI đang dựng bối cảnh mở màn — chờ một chút nhé.': 'AI 正在构建开场场景——请稍候。',
  'Chế độ': '模式', 'Hồ sơ': '档案', 'Thân phận': '身份', 'Tính cách': '性格', 'Sandbox': '沙盒', 'Xuất thân': '出身', 'Tông truyện': '故事风格', 'Mở đầu': '开场',
  'Chọn luật vận hành cho cả hành trình': '选择整段旅程的运行规则', 'Ảnh đại diện (tuỳ chọn)': '头像（可选）', 'Tên nhân vật': '角色名', 'Giới tính': '性别', 'Tuổi': '年龄', 'Đặc điểm ngoại hình (tuỳ chọn)': '外貌特征（可选）',
  'Về Pokémon khởi đầu': '关于初始宝可梦', 'Tiền khởi đầu': '初始资金', 'Loài': '种类', 'Hình thái / Form': '形态 / Form', 'Kích thước': '体型', 'Vật phẩm khởi đầu': '初始物品', 'Ngày bắt đầu (lịch trong truyện)': '开始日期（故事内日历）', 'Ngày': '日', 'Tháng': '月', 'Năm': '年',
  'Chọn cách câu chuyện mở màn — mỗi lựa chọn có mô tả đầy đủ bên dưới.': '选择故事如何开场——每个选项下方都有完整说明。', '🎲 Để AI tự nghĩ': '🎲 让 AI 决定', '✎ Tự viết mở đầu riêng': '✎ 自定义开场',
  'Chọn tất cả': '全选', 'Auto / Xoá chọn': '自动 / 清除', 'Huỷ sửa': '取消编辑', 'Sửa': '编辑', '+ Thêm': '+ 添加', '+ Thêm Pokémon': '+ 添加宝可梦',
  '🎲 Tự động': '🎲 自动', '🎲 Tự động theo tỉ lệ canon': '🎲 按原作比例自动', '— Chọn —': '— 选择 —', 'Chọn loài trước': '请先选择种类', 'Không bắt buộc': '可选', 'Không cầm': '不携带',
  '31 tất cả': '全 31', '252 tất cả · Sandbox': '全 252 · 沙盒', '0 tất cả': '全 0', 'Tự nhập': '自定义', '🎲 Random 0–31': '🎲 随机 0–31',
  'Chiêu thức Sandbox · full learnset': '沙盒招式 · 完整可学习招式表', 'Đang tải learnset đầy đủ… Có thể tiếp tục cấu hình; danh sách sẽ tự hiện khi dữ liệu sẵn sàng.': '正在加载完整可学习招式表… 可以继续配置，数据就绪后列表会自动出现。',
  'Không tìm thấy learnset cho form này. Nếu form kế thừa loài gốc, hãy thử chọn form mặc định.': '未找到该形态的可学习招式表。若该形态继承基础种类，请尝试默认形态。', 'Không có chiêu khớp tìm kiếm.': '没有符合搜索条件的招式。', 'Tìm chiêu, hệ hoặc nguồn học…': '搜索招式、属性或学习来源…',
  'Friendship 0–255': '亲密度 0–255', 'Biệt danh': '昵称', 'BIỆT DANH / NICKNAME': '昵称 / NICKNAME',
  'Cài đặt': '设置', 'Quay lại': '返回', 'Lưu': '保存', 'Huỷ': '取消', 'Xoá': '删除', 'Đóng': '关闭', 'Xác nhận': '确认', 'Tìm kiếm': '搜索',
  '👤 Nhân vật': '👤 角色', '🗺 Bản đồ & menu': '🗺 地图与菜单', 'Nhân vật': '角色', 'Bản đồ & menu': '地图与菜单',
  'Người chơi': '玩家', '(chưa đặt tên)': '（未命名）', 'Xoá lịch sử chat': '清空聊天记录', 'Câu chuyện chưa bắt đầu.': '故事尚未开始。',
  'Lựa chọn hành động': '行动选择', 'BƯỚC TIẾP THEO': '下一步', 'Bấm để điền · vẫn sửa được trước khi gửi': '点击填入 · 发送前仍可编辑', '↻ Gợi ý lại': '↻ 重新生成建议', '↻ Đang tạo…': '↻ 正在生成…', 'Đang đọc tình huống để chuẩn bị gợi ý…': '正在读取情境并准备建议…', 'Đưa hành động này vào ô nhập': '将此行动填入输入框',
  'Túi đồ': '背包', 'Đội hình': '队伍', 'Pokédex': '宝可梦图鉴', 'Nhật ký': '日志', 'Bản đồ': '地图', 'Trang bị': '装备', 'Trang sức / phụ kiện Pokémon': '宝可梦饰品 / 配件', 'Thức ăn Pokémon': '宝可梦食物', 'Hồi phục Pokémon': '宝可梦恢复道具', 'Đồ dùng sinh hoạt': '日用品', 'Tiện ích': '杂项工具', 'Trang bị Pokémon': '宝可梦携带物',
  'Thông tin': '信息', 'Chỉ số': '能力值', 'Chiêu thức': '招式', 'Chỉ số thực tế': '实战能力值', 'IV — Chỉ số bẩm sinh': 'IV — 个体值', 'EV — Điểm rèn luyện': 'EV — 努力值', 'Tổng EV': 'EV 总和',
  'Tên loài': '种类', 'Hệ': '属性', 'Nature': '性格', 'Ability': '特性', 'Hình thái': '形态', 'Shiny': '异色', 'Đực': '雄性', 'Cái': '雌性', 'Vô giới tính': '无性别',
  'Trung tâm Pokémon': '宝可梦中心', 'Cửa hàng': '商店', 'Mua': '购买', 'Bán': '出售', 'Số lượng': '数量', 'Giá': '价格', 'Tiền': '金钱',
  'Trận đấu': '对战', 'Tấn công': '攻击', 'Đổi Pokémon': '替换宝可梦', 'Vật phẩm': '道具', 'Chạy': '逃跑', 'Terastal': '太晶化', 'Chọn hệ Tera': '选择太晶属性', 'Đấu đôi 2v2': '双打 2v2', 'Thắng': '胜利', 'Thua': '失败', 'Chạy thoát': '逃脱', 'Lượt': '回合',
  'Cài đặt API và mô hình': 'API 与模型设置', 'API chính': '主 API', 'API phụ': '辅助 API', 'Model': '模型', 'Kiểm tra kết nối': '测试连接', 'Đã kết nối': '已连接',
  'Trò chuyện & bàn phím': '聊天与键盘', 'Tự động cuộn xuống khi có tin mới': '有新内容时自动滚动到底部', 'Enter = Gửi': 'Enter = 发送', 'Enter = Xuống dòng': 'Enter = 换行', 'Developer · Debug model': '开发者 · 模型调试', 'Bật LLM Debug Modal': '启用 LLM 调试窗口', '🐞 LLM Debug': '🐞 LLM 调试',
  'Ngôn ngữ': '语言', 'Tiếng Việt': '越南语', 'Tiếng Anh': '英语', 'Tiếng Trung': '中文',
  'Sẵn sàng': '就绪', 'Đang tải…': '加载中…', 'Đang tải': '加载中', 'Không có dữ liệu': '无数据', 'Chưa có': '暂无', 'Không': '否', 'Có': '是', 'Mở': '打开', 'Tháo': '卸下', 'Đeo': '装备', 'Dùng': '使用', 'Tạo': '创建', 'Thêm': '添加', 'Xoá chọn': '清除选择', 'Tự động': '自动',
  'Bạn là ai?': '你是谁？', 'Thân phận — xuất phát điểm xã hội của bạn': '身份——你的社会起点', 'Tính cách & năng lực — nhân vật của bạn là người thế nào?': '性格与能力——你的角色是怎样的人？', 'Sandbox — chốt tài nguyên & Pokémon khởi đầu': '沙盒——配置初始资源与宝可梦', 'Quê nhà & thời điểm bắt đầu': '故乡与开始时间', 'Thể loại — câu chuyện mang hương vị nào?': '类型——这是一段怎样的故事？', 'Câu chuyện bắt đầu thế nào?': '故事如何开始？',
  '⚡ Nạp nhân vật đã lưu': '⚡ 载入已保存角色', 'Xoá hồ sơ này': '删除此档案', "Để trống = 'Nhà Huấn Luyện'": "留空 = '训练家'", 'VD 16': '例如 16',
  'TỰ TẠO': '自定义', '✎ Thân phận riêng của bạn': '✎ 自定义身份', '⚙ App nhận diện cơ chế:': '⚙ 应用识别到的机制：', '⚙ Luật năng lực theo chế độ': '⚙ 各模式能力规则',
  'Chốt state khởi đầu tự do. Những gì đặt ở đây được ghi thẳng vào save trước khi AI viết mở đầu; sau đó hành trình vận hành như Anime.': '自由配置初始状态。这里设置的内容会在 AI 编写开场前直接写入存档；之后旅程按 Anime 规则运行。',
  'Thành phố / khu xuất thân trong': '城市 / 出身区域：', 'Chế độ đã chọn:': '已选模式：', 'Tag văn phong (chọn tự do — có thể phối nhiều tag)': '文风标签（自由选择，可组合多个）', 'TỔNG KẾT NHÂN VẬT': '角色总结',
  '⚖ Thực tế': '⚖ 现实', 'Luật cứng, hậu quả thật': '严格规则，真实后果', '🌸 Anime': '🌸 动画', 'Tình bạn và cao trào': '友情与高潮', '🧰 Sandbox': '🧰 沙盒', 'Tự do thiết lập, chơi theo luật Anime': '自由配置，按 Anime 规则游玩', 'Thực tế': '现实',
  'Nam': '男性', 'Nữ': '女性', 'Khác / không tiết lộ': '其他 / 不透露', 'Nhà Huấn Luyện': '训练家',
  'Phiêu lưu': '冒险', 'Sảng văn': '爽文 / 强者流', 'Hài hước': '喜剧', 'Đời thường': '日常', 'Học đường': '校园', 'Trinh thám / bí ẩn': '推理 / 悬疑', 'Kinh dị': '恐怖', 'Bi kịch': '悲剧', 'Chính kịch': '正剧', 'Âm mưu / tổ chức ngầm': '阴谋 / 地下组织', 'Thi đấu / giải đấu': '竞技 / 大赛', 'Sinh tồn': '生存', 'Chăm sóc / nuôi dưỡng': '培育 / 养成', 'Gây dựng thế lực': '建立势力',
  'Kinh tế, pháp luật, sinh thái và tiến trình đều có trọng lượng. Chỉ dùng một năng lực dựng sẵn; không có năng lực tự tạo hay cheat. Đây là chế độ duy nhất cho phép trao đổi Pokémon.': '经济、法律、生态与成长进度都会产生真实影响。只允许一个内置能力；不允许自定义能力或作弊。这是唯一允许宝可梦交换的模式。',
  'Sandbox như anime: ý chí, kỳ tích và huyền thoại có thể đi theo cách người chơi muốn. Không có trao đổi dữ liệu giữa người chơi.': '动画式沙盒：意志、奇迹与传说可以按玩家想要的方向发展。不进行玩家间数据交换。',
  'Tự do cấu hình lúc tạo nhân vật: Pokémon khởi đầu, level, tiền, vật phẩm và sức mạnh. Sau khi bắt đầu, thế giới vận hành theo luật Anime; không có trao đổi dữ liệu giữa người chơi.': '创建角色时可自由设置初始宝可梦、等级、金钱、物品与力量。开始后世界按 Anime 规则运行；不进行玩家间数据交换。',
  'Chế độ quyết định luật dữ liệu, tiến trình và những gì chính văn được phép làm. Lựa chọn này được khoá theo hành trình để save và trao đổi không bị lách luật.': '模式决定数据规则、成长进度以及正文可以确立的内容。该选择会随旅程锁定，避免通过存档或交换绕过规则。',
  'Điền thông tin cơ bản. Để trống phần nào cũng được — AI sẽ tự lo phần đó. Luật thế giới đã được chốt ở bước Chế độ; preset nhân vật bên dưới không thể đổi lựa chọn ấy.': '填写基本信息。任何项目都可以留空——AI 会自动处理。世界规则已在“模式”步骤确定；下方角色预设不能改变该选择。',
  'Thân phận quyết định cách thế giới nhìn bạn và những biến cố tự tìm tới bạn (Đạo diễn tình huống dùng đúng pool của thân phận này). Chọn một — hoặc tự viết ở cuối danh sách.': '身份决定世界如何看待你，以及哪些事件会自然找上门。选择一个，或在列表末尾自定义。',
  'Quê nhà định hình giọng nói, mối quan hệ đầu đời — và tổ chức phản diện nào lảng vảng trong tin tức địa phương. Mỗi vùng một khí chất riêng.': '故乡会塑造你的口音、早期关系，以及当地新闻中常出现的反派组织。每个地区都有独特气质。',
  'Mô tả cảnh mở màn bạn muốn — AI viết dựa theo ý này.': '描述你想要的开场场景——AI 会据此创作。',
  // 第123轮：关键创建角色选项内置翻译，Google 暂时不可用时也不会混入越南语。
  'Tiếp tục →': '继续 →', '← Quay lại': '← 返回',
  'Khởi đầu mở': '自由开局', 'Dân lao động': '劳动阶层', 'Gia tộc & quyền quý': '家族与权贵', 'Giới thi đấu': '竞技圈', 'Giới xám': '灰色地带', 'Thực thi pháp luật': '执法体系', 'Kiểm lâm & tự nhiên': '护林与自然', 'Học thuật': '学术界', 'Y tế': '医疗', 'Truyền thông': '媒体', 'Biểu diễn': '表演', 'Thương nghiệp': '商业', 'Nhân giống': '培育', 'Khác': '其他',
  'Tính cách (chọn bao nhiêu nét tuỳ thích)': '性格（可自由选择多个特质）',
  'Siêu năng lực (tuỳ chọn)': '特殊能力（可选）',
  'Chọn vài nét tính cách để AI khắc hoạ ĐÚNG nhân vật của bạn (không chọn thì AI dễ mặc định thành lạnh lùng, thực dụng). Có thể chọn nhiều nét.': '选择一些性格特质，让 AI 准确塑造你的角色。可以选择多个特质。',
  'Ấm áp, tốt bụng': '温暖、善良', 'Vui vẻ, lạc quan': '开朗、乐观', 'Dũng cảm, gan dạ': '勇敢、无畏', 'Hiền lành, nhẹ nhàng': '温柔、和善', 'Tò mò, ham học hỏi': '好奇、好学', 'Trung thành, nghĩa khí': '忠诚、讲义气', 'Bướng bỉnh, kiên định': '固执、坚定', 'Tinh nghịch, hài hước': '调皮、幽默', 'Nhút nhát, kín đáo': '害羞、内敛', 'Kiêu hãnh, tự tin': '骄傲、自信', 'Điềm tĩnh, chín chắn': '沉着、成熟', 'Nhiệt huyết, bốc đồng': '热血、冲动', 'Ranh mãnh, mưu mẹo': '机灵、狡黠', 'Lạnh lùng, ít nói': '冷淡、寡言', 'Tham vọng, quyết đoán': '有野心、果断', 'Giàu lòng trắc ẩn': '富有同情心',
  'Không có (người thường)': '没有（普通人）', 'Aura / Nội lực': '波导 / 内力', 'Psychic (Siêu năng lực)': '超能力（Psychic）', 'Thấu hiểu Pokémon': '理解宝可梦', 'Linh cảm / Tiên tri': '直觉 / 预知', 'Cảm ứng nguyên tố': '元素感应', 'Tự mô tả…': '自定义…',
  'Siêu năng lực được thể hiện có chừng mực, có giới hạn và cái giá của nó — không biến nhân vật thành bất khả chiến bại.': '特殊能力会以适度方式呈现，并有明确限制与代价——不会让角色变得无敌。',
  'Tân binh tự do': '自由新人', 'Làm thuê nông trại Pokémon': '宝可梦农场帮工', 'Dân chài': '渔家子弟', 'Con nhà thợ mỏ': '矿工家庭子弟', 'Trẻ mồ côi tự lập': '独立长大的孤儿',
  'Con cháu đại gia tộc': '名门望族后裔', 'Hậu duệ gia tộc sa sút': '没落家族后裔', 'Con của trainer nổi tiếng': '知名训练家的孩子',
  'Giang hồ đường phố': '街头灰色人物', 'Chân chạy vặt cho tổ chức': '组织跑腿', 'Cựu thành viên tổ chức đang rửa tay': '试图金盆洗手的前组织成员', 'Con nhà buôn lậu Pokémon': '宝可梦走私家庭子弟', 'Chỉ điểm hai mang': '双面线人', 'Cựu phụ việc săn trộm hoàn lương': '改过自新的前偷猎帮手',
  'Học viên cảnh sát': '警校学员', 'Con nhà cảnh sát': '警察家庭子弟', 'Trợ lý tập sự Cảnh sát Quốc tế': '国际警察见习助理',
  'Kiểm lâm tập sự': '见习护林员', 'Phụ việc khu bảo tồn': '保护区助手', 'Trợ lý nghiên cứu': '研究助理', 'Học việc khảo cổ': '考古学徒',
  'Thực tập sinh trung tâm Pokémon': '宝可梦中心实习生', 'Cứu hộ dã chiến': '野外救援员', 'Đệ tử gym': '道馆学徒', 'Thí sinh liên đoàn bỏ dở': '中途退出联盟赛的选手',
  'Phóng viên tập sự': '见习记者', 'Nhiếp ảnh gia hoang dã': '野生宝可梦摄影师', 'Nghệ sĩ đường phố cùng Pokémon': '宝可梦街头艺人', 'Con nhà thương lái rong': '行商家庭子弟', 'Con nhà trại nhân giống': '培育屋家庭子弟',

  ...ZH_STATIC_CATALOG,
  ...ZH_UI_EXTRAS,
}

const FALLBACK_EN = [
  ['Chọn ', 'Choose '], ['Đang ', ''], ['Không có ', 'No '], ['Chưa ', 'Not yet '], ['Thêm ', 'Add '], ['Xoá ', 'Delete '], ['Sửa ', 'Edit '], ['Lưu ', 'Save '], ['Mở ', 'Open '], ['Đóng ', 'Close '], ['Tạo ', 'Create '], ['Tự động', 'Auto'], ['tùy chọn', 'optional'], ['tuỳ chọn', 'optional'], ['khởi đầu', 'starting'], ['Pokémon khởi đầu', 'starter Pokémon'], ['thân mật', 'friendship'], ['trang bị', 'equipment'], ['vật phẩm', 'item'], ['hành động', 'action'], ['cài đặt', 'settings'], ['ngôn ngữ', 'language'],
]
const FALLBACK_ZH = [
  ['Chọn ', '选择'], ['Đang ', '正在'], ['Không có ', '没有'], ['Chưa ', '尚未'], ['Thêm ', '添加'], ['Xoá ', '删除'], ['Sửa ', '编辑'], ['Lưu ', '保存'], ['Mở ', '打开'], ['Đóng ', '关闭'], ['Tạo ', '创建'], ['Tự động', '自动'], ['tùy chọn', '可选'], ['tuỳ chọn', '可选'], ['khởi đầu', '初始'], ['Pokémon khởi đầu', '初始宝可梦'], ['thân mật', '亲密度'], ['trang bị', '装备'], ['vật phẩm', '道具'], ['hành động', '行动'], ['cài đặt', '设置'], ['ngôn ngữ', '语言'], ['Xem', '查看'], ['Sau', '下一页'], ['Trước', '上一页'], ['Trang', '页'], ['hiển thị', '显示'], ['đang bật', '已启用'],
]

function preserveWhitespace(source, translated) {
  const lead = source.match(/^\s*/)?.[0] ?? ''
  const tail = source.match(/\s*$/)?.[0] ?? ''
  return `${lead}${translated}${tail}`
}

function exactOffline(core, language) {
  if (language === 'zh') return ZH[core] || translateZhStatic(core) || null
  if (language === 'en') return EN[core] || null
  return core
}

function translateComposite(core, language) {
  // UI often joins already-translated labels at render time (traits, badges,
  // counters...). Translate each stable segment instead of requiring a giant
  // exact entry for every possible combination. Story text is excluded before
  // reaching this function by UiLanguageRuntime.
  for (const separator of [' · ', ' / ']) {
    if (!core.includes(separator)) continue
    const parts = core.split(separator)
    const translated = parts.map((part) => exactOffline(part.trim(), language))
    if (translated.every(Boolean)) return translated.join(separator)
  }
  return null
}

const ZH_SEASONS = { xuân: '春', hạ: '夏', thu: '秋', đông: '冬' }
const EN_SEASONS = { xuân: 'Spring', hạ: 'Summer', thu: 'Autumn', đông: 'Winter' }
const ZH_DAYPARTS = { sáng: '早晨', trưa: '中午', chiều: '下午', tối: '晚上', đêm: '夜晚' }
const EN_DAYPARTS = { sáng: 'Morning', trưa: 'Noon', chiều: 'Afternoon', tối: 'Evening', đêm: 'Night' }

function translateDynamicUi(core, language) {
  let m = core.match(/^Trang\s+(\d+)\s*\/\s*(\d+)$/u)
  if (m) return language === 'zh' ? `第 ${m[1]} / ${m[2]} 页` : `Page ${m[1]} / ${m[2]}`

  m = core.match(/^Buổi\s+([^·]+?)\s*·\s*(\d+\/\d+\/\d+)$/u)
  if (m) {
    const key = m[1].trim().toLowerCase()
    const part = language === 'zh' ? (ZH_DAYPARTS[key] ?? m[1].trim()) : (EN_DAYPARTS[key] ?? m[1].trim())
    return language === 'zh' ? `时段 ${part} · ${m[2]}` : `${part} · ${m[2]}`
  }

  m = core.match(/^Mùa\s+([^·]+?)\s*·\s*(.+)$/u)
  if (m) {
    const key = m[1].trim().toLowerCase()
    const season = language === 'zh' ? (ZH_SEASONS[key] ?? m[1].trim()) : (EN_SEASONS[key] ?? m[1].trim())
    const weather = exactOffline(m[2].trim(), language) || m[2].trim()
    return language === 'zh' ? `季节 ${season} · ${weather}` : `Season ${season} · ${weather}`
  }

  m = core.match(/^Đang phát:\s*(.+)$/u)
  if (m) return language === 'zh' ? `正在播放：${m[1]}` : `Playing: ${m[1]}`

  m = core.match(/^Pokédex\s*·\s*thấy\s*(\d+)\s*\/\s*bắt\s*(\d+)$/iu)
  if (m) return language === 'zh' ? `Pokédex · 已见 ${m[1]} / 已捕获 ${m[2]}` : `Pokédex · seen ${m[1]} / caught ${m[2]}`

  m = core.match(/^Nhật ký\s*·\s*(\d+)\s*huy hiệu\s*\/\s*(\d+)\s*việc$/iu)
  if (m) return language === 'zh' ? `日志 · ${m[1]} 枚徽章 / ${m[2]} 项任务` : `Journal · ${m[1]} badges / ${m[2]} tasks`

  m = core.match(/^Đời sống\s*·\s*(\d+)\s*trứng$/iu)
  if (m) return language === 'zh' ? `生活 · ${m[1]} 枚蛋` : `Life · ${m[1]} eggs`

  m = core.match(/^Regex preset:\s*prompt \+ hiển thị\s*\((\d+)\/(\d+)\s*đang bật\)$/iu)
  if (m) return language === 'zh' ? `Regex 预设：prompt + 显示（${m[1]}/${m[2]} 已启用）` : `Regex preset: prompt + display (${m[1]}/${m[2]} enabled)`

  return null
}

function translateCore(core, language) {
  if (!core || language === 'vi') return core
  const exact = exactOffline(core, language)
  if (exact) return exact
  const composite = translateComposite(core, language)
  if (composite) return composite
  const dynamic = translateDynamicUi(core, language)
  if (dynamic) return dynamic
  const fallback = language === 'zh' ? FALLBACK_ZH : FALLBACK_EN
  // Fully offline best-effort fallback for short interface labels. Long UI
  // descriptions are intentionally translated as exact catalog entries.
  if (core.length > 72) return core
  let out = core
  for (const [from, to] of fallback) out = out.replaceAll(from, to)
  return out
}

export function hasExactUiTranslation(source, language) {
  const lang = normalizeUiLanguage(language)
  if (lang === 'vi') return true
  const core = String(source ?? '').trim()
  if (!core) return true
  if (lang === 'zh') return Boolean(ZH[core] || hasZhStaticTranslation(core))
  return Boolean(EN[core])
}

export function translateUiText(source, language) {
  const text = String(source ?? '')
  const core = text.trim()
  if (!core) return text
  return preserveWhitespace(text, translateCore(core, normalizeUiLanguage(language)))
}
