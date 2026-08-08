import { parseBadgeDirective, parseQuestDirective } from '../data/worldProgress.js'
import { normalizePokemonGender } from '../data/pokemonGender.js'

// ============ GIAO THỨC TRẠNG THÁI TRONG CHÍNH VĂN (đợt 24) ============
// Cùng triết lý với [[BATTLE]] và [[DMG]]: AI kể chuyện bằng lời, còn các
// thay đổi TRẠNG THÁI GAME (tiền, hảo cảm NPC, thương tích cơ thể, vào cửa
// hàng) được khai báo qua tag máy-đọc-được ở CUỐI tin nhắn. App parse tag,
// áp vào state thật (HUD cập nhật ngay), rồi ẨN tag khỏi văn bản hiển thị.
//
// Cú pháp (mỗi tag 1 dòng riêng, đặt ở cuối tin, có thể nhiều tag):
//   [[MONEY +500]]            — nhận/mất tiền (số âm là mất)
//   [[REL Misty=+10]]         — hảo cảm NPC thay đổi (upsert theo tên)
//   [[REL Misty=-15 | cãi nhau ở gym]]   — kèm ghi chú mới (tuỳ chọn)
//   [[BODY leftArm=+25]]      — bộ phận bị thương thêm (+) hoặc hồi phục (-)
//       bộ phận hợp lệ: head, torso, leftArm, rightArm, leftLeg, rightLeg
//   [[SHOP Tiệm PokéMart Cerulean]]      — người chơi ĐÃ bước vào bên trong
//       cửa hàng và có thể mua sắm → app hiện nút mở giao diện giỏ hàng.
//   [[EVOLVE Froakie | Frogadier]]       — cùng cá thể tiến hoá, không sinh con mới.
//   [[FRIEND Froakie | +5 | tin tưởng hơn]] — độ thân mật cá thể 0-255.

export const BODY_PART_KEYS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']

export const STORY_STATE_INSTRUCTION = `GIAO THỨC TRẠNG THÁI (bắt buộc tuân theo): khi diễn biến trong đoạn bạn viết làm thay đổi trạng thái game, hãy khai báo bằng tag ở CUỐI tin nhắn, mỗi tag 1 dòng riêng (người chơi không nhìn thấy tag — đừng nhắc tới chúng trong lời kể):
- Tiền thay đổi (được thưởng, mua bán lẻ, bị cướp...): [[MONEY +500]] hoặc [[MONEY -200]]. MONEY chỉ ghi giao dịch ĐÃ HOÀN TẤT, không ghi giá niêm yết/ý định. Nếu câu có cả tổng thanh toán và số dư còn lại, tag phải là đúng DELTA giao dịch (hoặc số dư sau - số dư trước), tuyệt đối không lấy số dư, level, số lượng vật phẩm hay số Route làm MONEY. Nếu đơn hàng có nhiều món, ưu tiên tổng/thành tiền/hóa đơn đã thanh toán; không đoán đơn giá × số lượng khi văn chưa chốt tổng.
- Hảo cảm NPC thay đổi (giúp đỡ, cãi vã, tặng quà...): [[REL Tên NPC=+10]] (từ -100 tới +100, mỗi lần đổi 1-15 điểm là hợp lý; có thể kèm ghi chú: [[REL Misty=+8 | cùng nhau tuần tra bờ hồ]]). Chỉ dùng cho NPC có tên, xuất hiện thật trong truyện.
- Nhân vật chính BỊ THƯƠNG hoặc HỒI PHỤC phần thân thể nào (thế giới này Pokémon tấn công con người là chuyện bình thường): [[BODY leftArm=+25]] (dương = thương thêm, âm = hồi phục; bộ phận: head, torso, leftArm, rightArm, leftLeg, rightLeg; 0 lành lặn, 100 là mất/hỏng hẳn — vết cào nhẹ +5~10, trúng đòn nặng +20~40, gãy/bỏng nặng +50+). Mô tả vết thương trong lời kể phải khớp với tag.
- CHỈ khi nhân vật đã THỰC SỰ BƯỚC VÀO BÊN TRONG cửa hàng, đang đứng trước quầy/kệ và lượt kể dừng để người chơi chọn mua: [[SHOP Tên cửa hàng | loại=... | quy mô=nhỏ/vừa/lớn]] — loại ∈ {trainer (Poké Mart: bóng/thuốc như game), tạp hoá, quần áo, dã ngoại, leo núi, bách hoá}; hệ thống TỰ SINH danh sách hàng thật. Đi tới một thành phố, đi ngang/nhìn thấy cửa hàng, nhắc tên trung tâm mua sắm, hoặc chỉ nói “sẵn tiện mua sau” thì TUYỆT ĐỐI KHÔNG dùng SHOP. Chính văn phải nói rõ nhân vật đã vào trong; đừng tự liệt kê hàng, chỉ tả không khí rồi dừng.
- Khi nhân vật đã THỰC SỰ lấy được một đống đồ không thể liệt kê chính xác từng món (vơ vét kho, trộm hàng, thu chiến lợi phẩm, nhặt đồ sau tai nạn): [[LOOT loại=đá quý | quy mô=nhỏ/vừa/lớn]]. App tự sinh vật phẩm theo loại ∈ {đá quý, y tế, trainer, thực phẩm, công nghệ, quần áo, tổng hợp}. Chỉ dùng sau khi việc lấy đồ đã thành công trong chính văn, không dùng cho ý định “sẽ vơ vét” và TUYỆT ĐỐI không dùng LOOT để gom hàng mua tại cửa hàng; hàng đã mua phải dùng từng ITEM đúng tên/số lượng. Ở Thực tế phải kể cả phản ứng pháp luật/truy nã hợp lý nếu đó là trộm cắp.
- Người chơi THẬT SỰ có được một Pokémon MỚI trong diễn biến (được tặng, nhận nuôi, thu phục ngoài trận, cứu và nó đi theo, mua hợp lệ...): [[POKEMON Tên loài | Lv7]] — hệ thống sẽ tự dựng chỉ số thật và đưa vào đội. Nếu chính văn xác lập giới tính thì BẮT BUỘC giữ đúng bằng [[POKEMON Tên loài | Lv7 | giới tính=đực/cái/vô giới tính]]; chỉ bỏ field khi văn thật sự không nói để app roll theo tỉ lệ loài. Giao dịch qua PC/Box cũng phải dùng POKEMON khi hệ thống đã xác nhận chuyển giao và nhân vật thực sự lấy/cầm Poké Ball; không dùng nếu người bán mới hứa “sẽ gửi”, kiện còn chờ hoặc giao dịch thất bại. Nếu nhân vật lấy/nhặt/trộm một Poké Ball nhưng CHƯA biết nội dung/tình trạng, TUYỆT ĐỐI chưa bịa POKEMON và không cộng Poké Ball rỗng: dùng [[ITEM Poké Ball chưa xác định | 1]] cùng FACT ghi nguồn gốc. Khi một lượt sau mở/kiểm tra bóng và chính văn xác nhận loài bên trong, mới dùng [[POKEMON Loài | LvN]]; app tự tiêu thụ vật chứa chưa xác định, không cần ITEM -1. Nếu kiểm tra xác nhận bóng trống và còn dùng được, chuyển bằng [[ITEM Poké Ball chưa xác định | -1]] + [[ITEM Poké Ball | 1]]; nếu bóng hỏng/bị trả/bị tịch thu thì chỉ trừ bóng chưa xác định. KHÔNG dùng POKEMON cho tiến hoá. Ở chế độ THỰC TẾ: mở đầu "tay trắng" thì Pokémon đầu tiên phải đến từ diễn biến hợp lý; level theo hoàn cảnh, sinh thái, giai đoạn tiến hoá và kinh nghiệm trainer, app được nắn level lệch; không tự cấp dồn dập khi người chơi chưa chọn nhận. Câu “đi tìm/tìm kiếm Pokémon X” chỉ khởi tạo việc tìm: tìm chung chỉ được manh mối gián tiếp hoặc không có kết quả, tuyệt đối không dùng POKEMON/BATTLE và không cho X xuất hiện trực tiếp; áp cả với loài thường như Ditto. Phải theo manh mối cụ thể ít nhất ba bước; sau đó app mới có thể cho một lượt vượt phân xử xác suất thấp, nhưng sinh cảnh/thời điểm vẫn phải hợp và gặp không đồng nghĩa bắt/gia nhập. Ở ANIME/SANDBOX: tôn trọng quyền tác giả của người chơi về cách nhận, loài và level; không viện sinh thái hay độ hiếm để bác hoặc bóp level đã tuyên bố.
- LUẬT LIÊN ĐOÀN ENDGAME MẶC ĐỊNH: mỗi Tứ Thiên Vương dùng đội 6 Pokémon Lv85, Lv85, Lv90, Lv90, Lv95, Lv95; Champion dùng Lv98, Lv98, Lv99, Lv99, Lv100, Lv100. Ở Thực tế không hạ level theo người chơi. Ở Anime/Sandbox, đây chỉ là mốc mặc định và nhường cho thiết lập mà người chơi chủ động viết.
- Pokémon đang sở hữu TIẾN HOÁ thành loài khác: [[EVOLVE Tên hiện tại | Tên sau tiến hoá]]. Đây là CÙNG MỘT CÁ THỂ: app giữ uid/IV/EV/nature/EXP và thay hình ảnh/chỉ số loài; tuyệt đối không dùng [[POKEMON loài mới]] vì sẽ tạo bản sao. Nếu tiến hoá xảy ra đúng lúc lên cấp, khai cả [[LEVEL tên cũ | +1]] rồi [[EVOLVE tên cũ | tên mới]].
- Pokémon đang sở hữu THỰC SỰ ĐƯỢC CHO CẦM trang bị trong chính văn: [[EQUIP Tên Pokémon | Tên vật phẩm]]. Vật phẩm phải đang có trong túi, phải là held item hợp lệ; EQUIP tự chuyển đúng 1 món khỏi túi nên KHÔNG xuất thêm [[ITEM ... | -1]] cho cùng hành động; nếu thay món cũ, app tự cất món cũ lại túi. Khi nhân vật tháo/cất trang bị: [[UNEQUIP Tên Pokémon]]. Key Stone, Z-Ring, Dynamax Band và Tera Orb là thiết bị của HUẤN LUYỆN VIÊN, không dùng EQUIP cho Pokémon.
- Độ THÂN MẬT của một Pokémon đang sở hữu thay đổi vì hành động trong chính văn: [[FRIEND Tên Pokémon | +5 | lý do ngắn]] hoặc số âm khi niềm tin bị tổn thương. Chỉ dùng khi truyện thể hiện Pokémon được chăm sóc, được cứu, được khen/tặng món yêu thích, cùng vượt khó, bị bỏ rơi/ngược đãi hoặc mất niềm tin; KHÔNG cộng chỉ vì xuất hiện cùng nhau. Số điểm phải phản ánh đúng mức độ sự kiện; không có trần tuỳ tiện cho một lượt, app chỉ kẹp tổng canon 0-255.
- Nhân vật NHẬN ĐƯỢC hoặc MẤT ĐI vật phẩm (được tặng, nhặt, trộm/cuỗm thành công, mua và đã thanh toán, dùng hết, bị lấy mất): [[ITEM Tên vật phẩm | số lượng]] — số lượng âm là mất đi, bỏ trống là 1. VD: [[ITEM Potion | 2]], [[ITEM Kẹo Hiếm]], [[ITEM Poké Ball | -1]]. Phải giữ ĐÚNG loại và số lượng chính văn xác nhận; một món không được biến thành x20. Poké Ball đang chứa một loài chưa rõ phải dùng đúng tên đặc biệt [[ITEM Poké Ball chưa xác định | 1]], không dùng ITEM Poké Ball thường. Khi chính văn liệt kê chính xác giỏ hàng rồi xác nhận thanh toán/đóng gói, khai từng ITEM đúng tên và số lượng, không thay bằng LOOT ngẫu nhiên. CHỈ dùng khi truyện THỰC SỰ trao/lấy đồ; đừng tự phát đồ cho người chơi vô cớ. Nếu NĂNG LỰC ĐẶC BIỆT của người chơi (mục SIÊU NĂNG LỰC ĐẶC BIỆT ở trên) nói rằng họ có sẵn hay tạo ra được một loại vật phẩm nào đó, thì hãy DÙNG TAG NÀY để biến điều đó thành thật trong túi đồ, thay vì chỉ kể suông rồi để số liệu đứng yên.
- Pokémon TĂNG CẤP TRỰC TIẾP vì Kẹo Hiếm hoặc một năng lực đặc biệt (không phải EXP trận/luyện tập): [[LEVEL Tên Pokémon | +1]] hoặc [[LEVEL Tên Pokémon | Lv11]]. Dùng +N khi tăng N cấp, dùng LvN khi truyện chốt cấp đích. Nếu dùng Kẹo Hiếm hữu hạn thì khai thêm [[ITEM Kẹo Hiếm | -1]]; nếu năng lực ghi Kẹo Hiếm vô hạn thì KHÔNG trừ. TUYỆT ĐỐI không dùng [[POKEMON]] để báo một Pokémon cũ lên cấp, và không dùng [[LEVEL]] sau trận thường hay [[TRAIN]] vì app đã tự tính EXP.
- Nhân vật BƯỚC VÀO TRUNG TÂM POKÉMON (Pokémon Center — nơi y tá Joy chữa trị): [[POKECENTER Tên trung tâm]] — hệ thống sẽ hiện 2 nút cho người chơi tự bấm: CHỮA TRỊ và MÁY PC. Vì vậy trong lời kể ĐỪNG tự ý viết rằng Pokémon đã được chữa xong hay đã đổi đội hình — chỉ tả cảnh bước vào, y tá chào hỏi, rồi DỪNG LẠI để người chơi chọn. Khi nhân vật rời đi thì kể rõ là đã rời khỏi trung tâm.\n- Nhân vật DI CHUYỂN tới một địa danh mới (thành phố/khu vực/route): [[MOVE Tên khu vực]]; nếu biết vị trí cụ thể trên bản đồ thì thêm toạ độ phần trăm [[MOVE Tên khu vực | x=42 | y=58]] (x: trái→phải 0-100, y: trên→dưới 0-100). VD [[MOVE Cerulean City | x=66 | y=24]]. Chỉ tag khi THỰC SỰ đổi chỗ; không bịa x/y khi văn bản không đủ rõ.
- Nhân vật hoặc Pokémon ĂN UỐNG / bỏ bữa / lao lực rõ rệt trong diễn biến: [[HUNGER người+25]] hoặc [[HUNGER pokemon+30]] (độ NO 0-100; ăn = cộng, đói lả/vận động nặng = trừ; app tự trừ dần theo ngày nên chỉ tag khi có sự kiện rõ ràng).
- Thời gian trong truyện trôi qua (ngủ một đêm, đi đường nhiều ngày, chờ đợi...): [[DATE +1]] (số ngày trôi); chuyển buổi trong cùng ngày: [[DATE buổi=sáng|trưa|chiều|tối|đêm]]. Ngày giờ hiện tại luôn được cung cấp trong ngữ cảnh — lời kể về thời gian phải khớp với nó.
- NPC CÓ TÊN xuất hiện lần đầu, hoặc lộ thông tin quan trọng mới: khai báo hồ sơ bằng [[NPC Tên | tuổi=24 | nghề=Kiểm lâm | đội=Pikachu Lv25, Luxray Lv30 | ghi chú=em gái của trưởng gym]] — các trường tuổi/nghề/đội/ghi chú đều tuỳ chọn, cập nhật NPC cũ thì chỉ cần ghi trường thay đổi. QUY TẮC TẠO NPC: tên phải ĐA DẠNG đúng chất thế giới Pokémon (đừng lặp lại mãi vài cái tên quen tay như "Elara"); tuổi + nghề nghiệp hợp bối cảnh (dân thường đa số KHÔNG phải trainer); nếu là trainer thì đội hình 1-6 Pokémon hợp nghề/vùng/kinh nghiệm (tân binh thường 1-2, trainer lâu năm 3-6), LEVEL PHẢI HỢP LÝ với khu vực hiện tại và trình độ thật của trainer (dân thường/tân binh thấp, kiểm lâm/cảnh sát trung bình, gym leader cao) — không lạm phát level chỉ để đuổi theo người chơi. NPC gặp lại phải giữ đúng đội đã lưu; chỉ cập nhật khi truyện thật sự cho thấy họ bắt thêm, tiến hoá hoặc luyện đội mạnh lên, không reroll đội theo mỗi lần xuất hiện.
- Khi người chơi THỰC SỰ được trao huy hiệu chính thức: [[BADGE Tên huy hiệu | region=Kanto | gym=Pewter Gym | leader=Brock]]. Huy hiệu là sưu tầm tự chọn trong sandbox; không trao chỉ vì thắng một trận không chính thức.
- Chỉ trong chế độ Thực tế, khi chính văn xác nhận ĐỦ điều kiện triệu hồi/cuộc gặp huyền thoại (đúng di vật, đúng địa điểm và nghi thức/lore), khai [[LEGENDARY_ACCESS Tên loài | reason=lý do cụ thể]]. Không dùng vì đủ huy hiệu/nhiệm vụ, không dùng chỉ vì người chơi tuyên bố. Anime/Sandbox không cần cổng này.
- Nhiệm vụ được nhận/cập nhật/kết thúc rõ ràng: [[QUEST mã-ngắn | status=active|completed|failed|paused | title=... | giver=... | objective=... | reward=... | region=...]]. Dùng cùng một mã cho mọi lần cập nhật; chỉ completed khi chính văn xác nhận mục tiêu đã hoàn tất.
- Danh tiếng với PHE PHÁI thay đổi: [[REP Tên phe=+5 | lý do]]; khác với REL của một NPC. Phạm tội, cứu người, phá kế hoạch hoặc hoàn thành việc cho phe phải có hậu quả hợp lý.
- Mức TRUY NÃ thay đổi vì hành vi phạm pháp/được minh oan/nộp phạt: [[WANTED +1 | region=Kanto | reason=phá kho hàng | bounty=500]]. Số âm dùng khi giảm truy nã; không tự xoá chỉ vì sang lượt khác.
- Pokémon nhận Ribbon/Mark trong một sự kiện thật: [[RIBBON Tên Pokémon | Tên Ribbon]] hoặc [[MARK Tên Pokémon | Tên Mark]]. Shiny là thuộc tính cố định lúc sinh cá thể, tuyệt đối không đổi bằng tag hay lời kể.
- Pokémon được LUYỆN TẬP có chủ đích trong lượt này (tập chiêu, chạy bền, đối luyện, huấn luyện cùng NPC...): [[TRAIN cường độ]] với cường độ 1-3 (1 = tập nhẹ/ngắn, 2 = tập nghiêm túc cả buổi, 3 = tập khổ luyện cật lực). VD: [[TRAIN 2]]. Chỉ khai khi thực sự có cảnh luyện tập, KHÔNG khai cho việc đi đường hay đánh trận thường.
- Sự kiện/thoả thuận/mốc thời gian/địa danh QUAN TRỌNG cần nhớ lâu dài: [[FACT từ khoá 1, từ khoá 2 | nội dung CHI TIẾT]] — hoạt động như một entry World Info: phần trước dấu | là một hoặc nhiều TỪ KHOÁ KÍCH HOẠT (cách nhau bằng dấu phẩy: tên người, tên Pokémon, địa danh, tên vật phẩm...), phần sau là NỘI DUNG ĐẦY ĐỦ của sự kiện (ai, cái gì, ở đâu, điều kiện/hệ quả) để lần sau đọc lại là hiểu ngay ngữ cảnh — KHÔNG viết cụt kiểu vài chữ. VD: [[FACT Cubone, bà lão Lavender | Ngày 12/4 tại Lavender, người chơi hứa với bà lão Yui sẽ quay lại giúp tìm con Cubone bị mất trước mùa đông; bà hứa trả công bằng chiếc Moon Stone gia truyền]]. Chỉ ghi thông tin THẬT đã xảy ra, mỗi fact 1 dòng riêng.
Không bịa thay đổi không có trong diễn biến. Có thể viết tự nhiên bằng đại từ và tách một sự kiện qua nhiều câu/đoạn; app sẽ liên kết theo toàn sự kiện. KHÔNG có trần số tag hay số mặt hàng trong một lượt: chính văn xác nhận bao nhiêu thay đổi thì khai đủ bấy nhiêu, kể cả đơn mua trên 5 món. Chỉ phân biệt điều đã xảy ra với ý định/lời hứa/phủ định. Không dùng tag nào khác ngoài danh sách trên (và [[BATTLE]]). Mọi tag ĐẶT Ở CUỐI TIN, mỗi tag 1 dòng riêng — KHÔNG nhét tag vào giữa câu văn hay vào phần suy nghĩ. QUY TẮC CHĂM GHI SỔ (quan trọng): lượt nào xuất hiện NHÂN VẬT CÓ TÊN mới → PHẢI có [[NPC]]; lượt nào có sự kiện/thoả thuận/lời hứa/vật phẩm/địa điểm đáng nhớ lại về sau → PHẢI có [[FACT]] với nội dung chi tiết. Thà ghi hơi nhiều còn hơn bỏ sót — sổ tay này là trí nhớ dài hạn duy nhất của truyện.`

// Đợt 47: BỎ neo dòng (^…$) — thực chiến cho thấy model (nhất là khi CoT
// leak) hay nhét tag NẰM GIỮA câu văn ("…, [[MONEY -1000]], [[SHOP …]] .")
// → neo dòng làm tag câm hoàn toàn: tiền không trừ, fact không vào sổ tay,
// tag lộ nguyên văn ra màn hình. Tag có cặp [[..]] bao nên match giữa dòng
// vẫn an toàn, không đụng chính văn thường.
const MONEY_RE = /\[\[\s*MONEY\s*([+-]?\d+)\s*\]\]/gi
const POKEMON_RE = /\[\[\s*POKEMON\s+([^\]|]+?)\s*\|\s*Lv\.?\s*(\d+)\s*(?:\|\s*(?:giới\s*tính|gioi\s*tinh|gender)\s*=\s*([^\]|]+?))?\s*\]\]/gi
// Đợt 76: tiến hoá phải thay đúng cá thể, không được sinh thêm Pokémon cấp 2.
const EVOLVE_RE = /\[\[\s*(?:EVOLVE|EVOLUTION|TIẾN\s*(?:H[ÓO]A|HO[ÁA])|TIEN\s*HOA)\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
// Đợt 73: thay đổi cấp của Pokémon ĐANG SỞ HỮU. Trước đây model buộc phải
// lạm dụng [[POKEMON Froakie | Lv11]], app hiểu là nhận con mới rồi bỏ qua vì
// trùng loài — lời kể lên cấp nhưng biến đứng yên.
const LEVEL_RE = /\[\[\s*(?:LEVEL|LV|CẤP|CAP)\s+([^\]|]+?)\s*\|\s*(?:Lv\.?\s*)?([+-]?\d+)\s*\]\]/gi
const EQUIP_RE = /\[\[\s*(?:EQUIP|HOLD|TRANG\s*BỊ|TRANG\s*BI)\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
const UNEQUIP_RE = /\[\[\s*(?:UNEQUIP|UNHOLD|THÁO\s*TRANG\s*BỊ|THAO\s*TRANG\s*BI)\s+([^\]]+?)\s*\]\]/gi
const FRIEND_RE = /\[\[\s*(?:FRIEND|FRIENDSHIP|BOND|THÂN\s*MẬT|THAN\s*MAT)\s+([^\]|]+?)\s*\|\s*([+-]?\d+)\s*(?:\|\s*([^\]]*?))?\s*\]\]/gi
const DATE_ADV_RE = /\[\[\s*DATE\s*\+\s*(\d+)\s*\]\]/gi
// Đợt 67: buổi luyện tập có chủ đích → EXP cho Pokémon. cường độ 1-3.
const TRAIN_RE = /\[\[\s*TRAIN(?:\s+([^\]]*))?\s*\]\]/gi
const DATE_PART_RE = /\[\[\s*DATE\s+buổi\s*=\s*(sáng|trưa|chiều|tối|đêm)\s*\]\]/gi
const MOVE_RE = /\[\[\s*MOVE\s+([^\]]+?)\s*\]\]/gi
const HUNGER_RE = /\[\[\s*HUNGER\s+(người|nguoi|player|pokemon|pokémon)\s*([+-]\d+)\s*\]\]/gi
const NPC_RE = /\[\[\s*NPC\s+([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/gi
const FACT_RE = /\[\[\s*FACT\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
const REL_RE = /\[\[\s*REL\s+([^=\]|]+?)\s*=\s*([+-]?\d+)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/gi
const BODY_RE = /\[\[\s*BODY\s+(head|torso|leftArm|rightArm|leftLeg|rightLeg)\s*=\s*([+-]?\d+)\s*\]\]/gi
const SHOP_RE = /\[\[\s*SHOP\s+([^\]|]+?)(?:\s*\|\s*([^\]]*?))?\s*\]\]/gi
const LOOT_RE = /\[\[\s*LOOT\s+([^\]]+?)\s*\]\]/gi
// Đợt 71: nhân vật ĐANG Ở TRONG Trung tâm Pokémon → hiện nút Chữa trị + Máy PC.
// Tên sau tag là tuỳ chọn ([[POKECENTER]] hoặc [[POKECENTER Trung tâm Viridian]]).
// Đợt 72: AI TRAO / LẤY ĐI VẬT PHẨM. Đây là mắt xích còn thiếu khiến năng
// lực người chơi TỰ VIẾT không bao giờ thành hiện thực: tester viết "Rare
// Candy vô hạn" ở ô tùy chỉnh, AI kể "cho ăn kẹo, lên Lv11" nhưng biến không
// đổi — vì AI không hề có cách nào bỏ đồ vào túi. Nay có.
const ITEM_RE = /\[\[\s*ITEM\s+([^\]|]+?)(?:\s*\|\s*([+-]?\d+))?\s*\]\]/gi
const POKECENTER_RE = /\[\[\s*POKECENTER(?:\s+([^\]]+?))?\s*\]\]/gi
const BADGE_RE = /\[\[\s*BADGE\s+([^\]|]+?)(?:\s*\|\s*([^\]]*?))?\s*\]\]/gi
const QUEST_RE = /\[\[\s*QUEST\s+([^\]|]+?)(?:\s*\|\s*([^\]]*?))?\s*\]\]/gi
const REP_RE = /\[\[\s*REP\s+([^=\]|]+?)\s*=\s*([+-]?\d+)\s*(?:\|\s*([^\]]*?))?\s*\]\]/gi
const WANTED_RE = /\[\[\s*WANTED\s+([+-]?\d+)\s*(?:\|\s*([^\]]*?))?\s*\]\]/gi
const RIBBON_RE = /\[\[\s*RIBBON\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
const MARK_RE = /\[\[\s*MARK\s+([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi
const LEGENDARY_ACCESS_RE = /\[\[\s*LEGENDARY_ACCESS\s+([^\]|]+?)(?:\s*\|\s*reason\s*=\s*([^\]]+?))?\s*\]\]/gi

/**
 * Parse mọi tag trạng thái trong text. Trả về:
 * { money: tổng delta, rel: [{name, delta, note}], body: [{part, delta}],
 *   shops: [tên...], cleaned: text đã gỡ sạch tag }
 * Mỗi loại tag có regex riêng nên [[BATTLE]] và [[DMG]] không bị đụng tới.
 * Regex không neo dòng: model thực tế thường nhét tag giữa câu.
 */
export function parseStoryStateTags(text) {
  if (!text) return { money: 0, moneyEntries: [], rel: [], body: [], shops: [], loots: [], npcs: [], facts: [], pokemons: [], levels: [], evolutions: [], friendships: [], equipment: [], hunger: [], moves: [], moveDirectives: [], items: [], badges: [], quests: [], reputations: [], wanted: [], legendaryAccess: [], collectionAwards: [], dateAdvance: 0, training: 0, datePart: null, pokecenter: null, cleaned: text ?? '' }
  let money = 0
  const moneyEntries = []
  const rel = []
  const body = []
  const shops = []
  const loots = []
  const npcs = []
  const facts = []
  const pokemons = []
  const levels = []
  const evolutions = []
  const friendships = []
  const hunger = []
  const moves = []
  const moveDirectives = []
  let dateAdvance = 0
  let training = 0
  let datePart = null
  let pokecenter = null
  const items = []
  const badges = []
  const quests = []
  const reputations = []
  const wanted = []
  const legendaryAccess = []
  const collectionAwards = []

  for (const m of text.matchAll(MONEY_RE)) {
    const value = parseInt(m[1], 10)
    if (Number.isFinite(value) && value !== 0) {
      moneyEntries.push(value)
      money += value
    }
  }
  for (const m of text.matchAll(REL_RE)) {
    rel.push({ name: m[1].trim(), delta: parseInt(m[2], 10), note: (m[3] ?? '').trim() || null })
  }
  for (const m of text.matchAll(BODY_RE)) body.push({ part: m[1], delta: parseInt(m[2], 10) })
  // [[SHOP Tên | loại=... | quy mô=...]] (đợt 37) — shops giờ là OBJECT
  // {name, type, size}; code cũ nào còn đọc dạng string đã được cập nhật.
  for (const m of text.matchAll(SHOP_RE)) {
    const shop = { name: m[1].trim(), type: '', size: '' }
    if (m[2]) {
      for (const seg of m[2].split('|')) {
        const part = seg.trim()
        const eq = part.indexOf('=')
        if (eq > 0) {
          const k = part.slice(0, eq).trim().toLowerCase()
          const v = part.slice(eq + 1).trim()
          if (k.startsWith('loại') || k.startsWith('loai') || k === 'type') shop.type = v
          else if (k.startsWith('quy') || k === 'size') shop.size = v
        }
      }
    }
    shops.push(shop)
  }
  for (const m of text.matchAll(LOOT_RE)) {
    const loot = { type: 'tổng hợp', size: 'vừa' }
    for (const segment of String(m[1] ?? '').split('|')) {
      const part = segment.trim()
      const at = part.indexOf('=')
      if (at < 0) {
        if (part) loot.type = part
        continue
      }
      const key = part.slice(0, at).trim().toLowerCase()
      const value = part.slice(at + 1).trim()
      if (!value) continue
      if (key === 'type' || key.startsWith('loại') || key.startsWith('loai')) loot.type = value
      else if (key === 'size' || key.startsWith('quy')) loot.size = value
    }
    loots.push(loot)
  }
  // [[NPC Tên | key=value | key=value ...]] — phần sau tên là danh sách
  // trường key=value phân tách bởi |; đoạn không có dấu = thì gộp vào ghi chú.
  for (const m of text.matchAll(NPC_RE)) {
    const name = m[1].trim()
    const fields = {}
    if (m[2]) {
      for (const seg of m[2].split('|')) {
        const part = seg.trim()
        if (!part) continue
        const eq = part.indexOf('=')
        if (eq > 0) {
          const k = part.slice(0, eq).trim()
          const v = part.slice(eq + 1).trim()
          if (k && v) fields[k] = v
        } else {
          fields['ghi chú'] = fields['ghi chú'] ? `${fields['ghi chú']}; ${part}` : part
        }
      }
    }
    if (name) npcs.push({ name, fields })
  }
  for (const m of text.matchAll(FACT_RE)) {
    facts.push({ key: m[1].trim(), text: m[2].trim() })
  }
  // [[POKEMON Loài | Lv7]] — người chơi nhận Pokémon mới trong truyện (đợt 32).
  for (const m of text.matchAll(POKEMON_RE)) {
    const pokemon = {
      species: m[1].trim(),
      level: Math.max(1, Math.min(100, parseInt(m[2], 10))),
    }
    const gender = normalizePokemonGender(m[3])
    if (gender) pokemon.gender = gender
    pokemons.push(pokemon)
  }
  for (const m of text.matchAll(EVOLVE_RE)) {
    const from = m[1].trim()
    const to = m[2].trim()
    if (from && to) evolutions.push({ from, to })
  }
  for (const m of text.matchAll(LEVEL_RE)) {
    const raw = m[2].trim()
    const value = parseInt(raw, 10)
    if (Number.isFinite(value) && value !== 0) {
      levels.push({
        target: m[1].trim(),
        mode: /^[+-]/.test(raw) ? 'delta' : 'absolute',
        value: /^[+-]/.test(raw) ? value : Math.max(1, Math.min(100, value)),
      })
    }
  }
  for (const m of text.matchAll(FRIEND_RE)) {
    const delta = parseInt(m[2], 10)
    if (Number.isFinite(delta) && delta !== 0) friendships.push({
      target: m[1].trim(), delta, note: (m[3] ?? '').trim() || null,
    })
  }
  const equipment = []
  for (const m of text.matchAll(EQUIP_RE)) {
    const target = m[1].trim()
    const item = m[2].trim()
    if (target && item) equipment.push({ target, item, mode: 'equip' })
  }
  for (const m of text.matchAll(UNEQUIP_RE)) {
    const target = m[1].trim()
    if (target) equipment.push({ target, item: null, mode: 'unequip' })
  }
  for (const m of text.matchAll(DATE_ADV_RE)) dateAdvance += parseInt(m[1], 10)
  for (const m of text.matchAll(TRAIN_RE)) {
    const n = parseInt((m[1] ?? '').trim(), 10)
    training += Number.isFinite(n) ? Math.max(1, n) : 1
  }
  for (const m of text.matchAll(DATE_PART_RE)) datePart = m[1]
  for (const m of text.matchAll(ITEM_RE)) {
    const qty = m[2] ? Number(m[2]) : 1
    if (Number.isFinite(qty) && qty !== 0) items.push({ name: m[1].trim(), qty })
  }
  for (const m of text.matchAll(POKECENTER_RE)) pokecenter = { name: (m[1] ?? '').trim() || 'Trung tâm Pokémon' }
  // [[MOVE Nơi | x=.. | y=..]] (đợt 75): vẫn giữ `moves` dạng chuỗi cho
  // code cũ, đồng thời trả `moveDirectives` có toạ độ cho luồng mới.
  for (const m of text.matchAll(MOVE_RE)) {
    const segments = m[1].split('|').map((part) => part.trim()).filter(Boolean)
    const place = segments.shift() ?? ''
    let x = null
    let y = null
    for (const segment of segments) {
      const hit = segment.match(/^([xy])\s*=\s*(-?\d+(?:\.\d+)?)$/i)
      if (!hit) continue
      const value = Math.max(0, Math.min(100, Number(hit[2])))
      if (hit[1].toLowerCase() === 'x') x = value
      else y = value
    }
    if (place) {
      moves.push(place)
      moveDirectives.push({ place, x, y })
    }
  }
  for (const m of text.matchAll(HUNGER_RE)) {
    const who = /^p(okemon|okémon)$/i.test(m[1]) || m[1].toLowerCase().startsWith('pok') ? 'mon' : 'player'
    hunger.push({ who, delta: parseInt(m[2], 10) })
  }
  for (const m of text.matchAll(BADGE_RE)) badges.push(parseBadgeDirective(m[1], m[2]))
  for (const m of text.matchAll(QUEST_RE)) quests.push(parseQuestDirective(m[1], m[2]))
  for (const m of text.matchAll(REP_RE)) reputations.push({ name: m[1].trim(), delta: parseInt(m[2], 10), note: (m[3] ?? '').trim() })
  for (const m of text.matchAll(WANTED_RE)) {
    const fields = {}
    for (const segment of String(m[2] ?? '').split('|')) {
      const at = segment.indexOf('=')
      if (at > 0) fields[segment.slice(0, at).trim().toLowerCase()] = segment.slice(at + 1).trim()
    }
    wanted.push({ delta: parseInt(m[1], 10), region: fields.region ?? '', reason: fields.reason ?? '', bounty: parseInt(fields.bounty ?? '0', 10) || 0 })
  }
  for (const m of text.matchAll(RIBBON_RE)) collectionAwards.push({ kind: 'ribbon', target: m[1].trim(), name: m[2].trim() })
  for (const m of text.matchAll(MARK_RE)) collectionAwards.push({ kind: 'mark', target: m[1].trim(), name: m[2].trim() })
  for (const m of text.matchAll(LEGENDARY_ACCESS_RE)) legendaryAccess.push({ species: m[1].trim(), reason: (m[2] ?? '').trim() })

  const cleaned = text
    .replace(MONEY_RE, '')
    .replace(REL_RE, '')
    .replace(BODY_RE, '')
    .replace(SHOP_RE, '')
    .replace(LOOT_RE, '')
    .replace(POKECENTER_RE, '')
    .replace(ITEM_RE, '')
    .replace(NPC_RE, '')
    .replace(FACT_RE, '')
    .replace(POKEMON_RE, '')
    .replace(EVOLVE_RE, '')
    .replace(LEVEL_RE, '')
    .replace(FRIEND_RE, '')
    .replace(EQUIP_RE, '')
    .replace(UNEQUIP_RE, '')
    .replace(DATE_ADV_RE, '')
    .replace(TRAIN_RE, '')
    .replace(DATE_PART_RE, '')
    .replace(MOVE_RE, '')
    .replace(HUNGER_RE, '')
    .replace(BADGE_RE, '')
    .replace(QUEST_RE, '')
    .replace(REP_RE, '')
    .replace(WANTED_RE, '')
    .replace(RIBBON_RE, '')
    .replace(MARK_RE, '')
    .replace(LEGENDARY_ACCESS_RE, '')
    // Tag nằm giữa câu bị gỡ để lại vụn: ", ," / "( )" / 2 dấu cách — dọn nhẹ.
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;])\s*(?=[,;])/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]*[,.;]+[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { money, moneyEntries, rel, body, shops, loots, npcs, facts, pokemons, levels, evolutions, friendships, equipment, hunger, moves, moveDirectives, items, badges, quests, reputations, wanted, legendaryAccess, collectionAwards, dateAdvance,
    training, datePart, pokecenter, cleaned }
}

/**
 * Áp kết quả parse vào state game. Nhận state hiện tại + setters từ context.
 * Mọi giá trị đều được kẹp trong khoảng hợp lệ (tiền >= 0, hảo cảm -100..100,
 * thương tích 0..100) — AI có bịa số to cũng không phá được state.
 */
// LƯU Ý (đợt 45): dùng FUNCTIONAL UPDATER cho cả 3 setter — trước đây hàm
// này đọc state từ closure (playerProfile/relationships/bodyStatus) nên:
// (a) gọi từ callback nền của API cập nhật biến mà QUÊN truyền state hiện
//     tại → crash "undefined.money" (bị .catch nuốt → tiền/quan hệ bổ sung
//     rớt trong im lặng), và
// (b) closure cũ đè lên thay đổi mới khi 2 luồng (chính + API phụ) áp gần
//     nhau. Functional updater đọc state MỚI NHẤT nên hết cả 2 lỗi; các
//     tham số state cũ vẫn nhận vào cho tương thích chỗ gọi cũ nhưng không
//     dùng nữa. setRelationships/setBodyStatus trong GameContext đã được
//     nâng lên nhận functional updater (đợt 45).
export function applyStoryState(parsed, { setPlayerProfile, setRelationships, setBodyStatus }) {
  if (parsed.money !== 0) {
    setPlayerProfile((cur) => {
      const current = Number(cur?.money)
      const safeCurrent = Number.isFinite(current) ? current : 0
      return { ...(cur ?? {}), money: Math.max(0, safeCurrent + Number(parsed.money || 0)) }
    })
  }
  if (parsed.rel.length > 0) {
    setRelationships((cur) => {
      const next = [...(cur ?? [])]
      for (const r of parsed.rel) {
        const delta = Number(r.delta) || 0
        const idx = next.findIndex((x) => x.name.toLowerCase() === r.name.toLowerCase())
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            affinity: Math.max(-100, Math.min(100, (Number(next[idx].affinity) || 0) + delta)),
            note: r.note ?? next[idx].note,
          }
        } else {
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: r.name,
            affinity: Math.max(-100, Math.min(100, delta)),
            note: r.note ?? '',
          })
        }
      }
      return next
    })
  }
  if (parsed.body.length > 0) {
    setBodyStatus((cur) => {
      const next = { ...(cur ?? {}) }
      for (const b of parsed.body) {
        next[b.part] = Math.max(0, Math.min(100, (next[b.part] ?? 0) + b.delta))
      }
      return next
    })
  }
}
