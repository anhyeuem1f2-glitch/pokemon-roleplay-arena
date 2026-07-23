// ============ ĐẠO DIỄN TÌNH HUỐNG (Story Director — đợt 31) ============
// Giao thức THÚC ĐẨY cốt truyện: một "đạo diễn ngầm" phía app, thỉnh thoảng
// (theo nhịp độ có cooldown + xác suất tăng dần) chọn 1 HẠT GIỐNG TÌNH HUỐNG
// từ các pool có trọng số rồi chèn cho AI dưới dạng GỢI Ý một lần (không lưu
// vào lịch sử) — AI được dặn rõ: chỉ lồng vào khi hợp mạch, được phép bỏ qua.
//
// Triết lý (chốt với người dùng):
// - KHÔNG phải lúc nào cũng chiến đấu — slice of life, romance, phiêu lưu,
//   xã giao, cơ hội, sự kiện nền... mỗi loại một trọng số, không lặp loại
//   vừa dùng.
// - Tình huống theo THÂN PHẬN người chơi chọn (đại gia tộc → hứa hôn/liên
//   hôn/tranh quyền; giang hồ đường phố → investigator để mắt/ân oán cũ...).
// - CÔNG BẰNG: không dồn ép không lối thoát, cũng KHÔNG nịnh/aura farming —
//   mọi hạt giống đều được bọc trong quy tắc công bằng.
// - Phản diện VÙNG MIỀN hiện diện MỜ: ở vùng nào thì thi thoảng nghe ngóng
//   được tín hiệu nhỏ về tổ chức phản diện vùng đó — gián tiếp, không lộ liễu.
//
// Mọi random đều nhận rng inject được (mặc định Math.random) để unit test.

import { getRegion, getArea } from './regions.js'
import { getIdentityV2 } from './identities.js'

// ---------- THÂN PHẬN (đợt 32: chuyển sang data/identities.js, 30 thân phận) ----------
// Re-export để mọi nơi import từ storyDirector vẫn chạy như cũ.
export { IDENTITIES_V2 as IDENTITIES, getIdentityV2 as getIdentity } from './identities.js'

// ---------- TỔ CHỨC PHẢN DIỆN THEO VÙNG ----------
// Kiến thức nổi tiếng + ổn định của thế giới Pokémon (được phép gõ tay theo SKILL).
export const REGION_VILLAINS = {
  kanto: 'Team Rocket',
  johto: 'tàn dư Team Rocket',
  hoenn: 'Team Magma và Team Aqua',
  sinnoh: 'Team Galactic',
  unova: 'Team Plasma',
  kalos: 'Team Flare',
  alola: 'Team Skull (và những hoạt động mờ ám quanh Aether Foundation)',
  galar: 'Team Yell (và những toan tính của Macro Cosmos)',
  paldea: 'Team Star',
}

// ---------- POOL TÌNH HUỐNG ----------
// Mỗi hạt giống là 1 "kernel" ngắn — AI tự triển khai theo văn phong của nó.
// Placeholder: {area} tên khu, {region} tên vùng, {villain} tổ chức phản diện.
const POOLS = {
  slice_of_life: {
    weight: 26,
    seeds: [
      'Một quán ăn/quầy hàng nhỏ ở {area} có món đặc sản địa phương; người bán bắt chuyện thân thiện, hé ra một mẩu đời sống thường nhật của vùng này.',
      'Pokémon của người chơi bất chợt có hành động nghịch ngợm/đáng yêu rất "đúng tính cách loài", kéo theo một tương tác nhỏ với người xung quanh.',
      'Thời tiết hoặc quang cảnh {area} thay đổi rõ rệt (mưa rào, hoàng hôn đẹp, sương sớm...), ảnh hưởng tới nhịp sinh hoạt của người và Pokémon quanh đó.',
      'Một đứa trẻ địa phương tò mò xin xem Pokémon của người chơi, kể ríu rít vài chuyện của khu này.',
      'Một phiên chợ/lễ hội nhỏ đang diễn ra gần đó với trò chơi hoặc món ăn gắn với Pokémon bản địa.',
      'Một cụ già địa phương kể chuyện xưa của {area} — nửa thật nửa huyền thoại, không ai kiểm chứng được.',
      'Bầy Pokémon hoang dã vô hại đang làm chuyện gì đó ngộ nghĩnh (tha đồ, tắm nắng, giành lãnh thổ vặt vãnh) ngay trong tầm mắt.',
      'Đến giờ cơm/giờ nghỉ — một khoảnh khắc chậm rãi để nhân vật và Pokémon nghỉ ngơi, chăm sóc nhau sau chặng đường.',
    ],
  },
  romance: {
    weight: 11,
    toggleable: true,
    seeds: [
      'Một NPC người chơi đã quen (ưu tiên NPC có trong sổ tay/quan hệ) có một cử chỉ quan tâm tinh tế — chỉ là tín hiệu nhỏ, không vội vàng, không tỏ tình đường đột.',
      'Hoàn cảnh vô tình khiến người chơi phải đi cùng đường / trú mưa cùng một NPC hợp tuổi — không khí có chút ngượng ngùng tự nhiên.',
      'Một NPC ngập ngừng muốn nhờ riêng người chơi một việc nhỏ, có vẻ chỉ là cái cớ để được nói chuyện.',
      'Người chơi vô tình biết được một sở thích/mặt mềm yếu ít ai thấy của một NPC đã quen.',
    ],
  },
  adventure: {
    weight: 16,
    seeds: [
      'Có tin đồn về một địa danh thú vị gần {area} (hang nhỏ, đồng cỏ khuất, mỏm đá ngắm cảnh) — chỉ là lời rủ rê của thế giới, không phải nhiệm vụ.',
      'Dấu vết THOÁNG QUA của một Pokémon hiếm gặp trong vùng (tiếng kêu xa, vệt chân, vảy/lông rơi lại) — biến mất nếu không để tâm, không dí theo người chơi.',
      'Một người địa phương nhờ tìm giúp món đồ thất lạc / dẫn đường một đoạn — việc nhỏ, trả ơn nhỏ, từ chối cũng không sao.',
      'Người chơi nhặt được/nhìn thấy một manh mối cũ kỹ (mảnh bản đồ, tờ giấy nhoè, ký hiệu khắc trên đá) — ý nghĩa còn bỏ ngỏ.',
      'Một tuyến đường phụ ít người đi hé lộ trước mắt, nghe nói cảnh đẹp nhưng lắm Pokémon hoang.',
    ],
  },
  social: {
    weight: 12,
    seeds: [
      'Một trainer đồng trang lứa bắt chuyện, ngỏ ý so tài THÂN THIỆN — từ chối cũng được, họ không cay cú.',
      'Một cuộc tranh luận nho nhỏ đang diễn ra gần đó (về cách nuôi Pokémon, về tin tức vùng) — người chơi có thể góp lời hoặc chỉ nghe.',
      'Một NPC cũ (ưu tiên trong sổ tay) tình cờ xuất hiện ở {area} với việc riêng của họ — thế giới của họ vẫn chạy khi người chơi vắng mặt.',
      'Ai đó nhận nhầm người chơi với một người khác, dẫn tới một hiểu lầm vô hại và buồn cười.',
      'Một nhóm trainer địa phương đang bàn tán về gym/giải đấu gần nhất, vô tình để lộ thông tin hữu ích.',
    ],
  },
  trouble: {
    weight: 10,
    seeds: [
      'Một rắc rối NHỎ CÓ LỐI RA: món đồ của người chơi bị một Pokémon tinh nghịch tha đi — nó không ác ý và có thể lấy lại bằng nhiều cách.',
      'Hiểu lầm nhỏ với người địa phương (đứng nhầm chỗ, Pokémon làm đổ hàng...) — giải quyết được bằng lời nói, đền bù nhỏ, hoặc khiếu hài hước.',
      'Tuyến đường chính tạm bị chặn (cây đổ, đàn Pokémon di cư ngang) — phải chọn: chờ, đi vòng, hoặc tìm cách khác; mỗi lựa chọn đều đi tiếp được.',
      'Thời tiết xấu ập tới nhanh — cần tìm chỗ trú, và chỗ trú thường có người/Pokémon khác cũng đang trú.',
      'Người chơi để ý thấy mình bị một ánh mắt tò mò bám theo — hoá ra lý do rất đời thường (nếu người chơi tìm hiểu).',
    ],
  },
  opportunity: {
    weight: 8,
    seeds: [
      'Một việc làm thêm ngắn hạn được rao gần đó (phụ quầy, đưa đồ, trông Pokémon) — tiền công nhỏ nhưng thật.',
      'Một thương nhân thu mua thứ gì đó người chơi có thể đang có hoặc dễ kiếm quanh {area}.',
      'Người chơi được ai đó trả ơn/cảm kích vì một việc ĐÃ THẬT SỰ làm trước đó (dựa theo sổ tay/quan hệ — không bịa công lao).',
      'Tin vặt hữu ích: cửa hàng gần đây sắp giảm giá, hoặc trung tâm Pokémon có dịch vụ đặc biệt tuần này.',
    ],
  },
  world_event: {
    weight: 6,
    seeds: [
      'Một sự kiện NỀN diễn ra không liên quan trực tiếp tới người chơi: đoàn nghiên cứu đi ngang, đội thi công sửa đường, đàn Pokémon di cư theo mùa — thế giới vẫn sống kể cả khi không ai nhìn.',
      'Loa/radio/bảng tin địa phương phát một mẩu tin của {region} (thời tiết, giải đấu, chuyện lạ) — chỉ là phông nền.',
      'Hai NPC lạ nói chuyện riêng của họ gần đó — nghe được một mẩu, không đầu không cuối.',
      'Một chuyến tàu/phà/xe buýt tới trễ hoặc vừa rời bến — nhịp sống hạ tầng của vùng.',
    ],
  },
  villain_rumor: {
    weight: 8,
    needsRegion: true,
    seeds: [
      'MỘT TÍN HIỆU RẤT NHỎ về {villain} lọt vào tai người chơi: mẩu báo địa phương, lời xì xào cuối quầy, một chiếc xe/bộ đồng phục thoáng qua — KHÔNG đối đầu, không ai chú ý tới người chơi, chỉ là hạt bụi bất thường trong không khí {region}.',
      'Một người dân {area} phàn nàn bâng quơ về chuyện lạ gần đây (mất trộm vặt Pokémon, người lạ hỏi dò đường) — họ KHÔNG biết và KHÔNG nhắc tên {villain}; người tinh ý mới thấy có gì đó gợn.',
      'Bảng tin/cảnh sát khu vực dán một thông báo nhắc dân đề phòng chung chung — dấu hiệu {villain} hoạt động đâu đó trong {region}, mờ tới mức dễ bỏ qua.',
      'Một Pokémon hoang dã trong vùng có biểu hiện sợ người bất thường — như thể từng bị ai đó làm gì. Không manh mối nào rõ ràng hơn.',
    ],
  },
  battle_spark: {
    weight: 6,
    seeds: [
      'Một Pokémon hoang dã trong {area} tỏ ra kích động/lãnh thổ ở phía trước — NGƯỜI CHƠI có thể vòng tránh, xoa dịu, hoặc để nó thành một trận đấu; không ép.',
      'Một trainer cắm chốt kiểu "ai đi ngang cũng gạ đấu" xuất hiện — nhưng chấp nhận lời từ chối một cách bình thường.',
    ],
  },
}

// Pool THEO THÂN PHẬN — key là POOL KEY (nhiều thân phận dùng chung 1 pool,
// map qua field poolKey trong data/identities.js). Trọng số riêng từng pool.
const IDENTITY_POOLS = {
  criminal: {
    weight: 16,
    seeds: [
      'Một khuôn mặt từ đường dây cũ nhận ra người chơi ở {area} — chỉ gật đầu ra hiệu "thấy rồi đấy" rồi đi tiếp; thông điệp tự nó là thông điệp. Chưa ai làm gì ai.',
      'Tin trong giới: một chuyến hàng sắp đi qua {region} và người ta đang cần người quen việc — lời rủ CHƯA tới thẳng người chơi, mới chỉ là gió thổi. Nhận hay tránh còn cả quãng để tính.',
      'Người chơi nhận ra một dấu hiệu nghiệp vụ quen thuộc (điểm thả hàng, ký hiệu nguệch ngoạc, chiếc xe đậu sai kiểu) mà người thường sẽ bỏ qua — cái biết của người trong nghề, biết mà chẳng muốn biết.',
      'Một người từng dính líu tới thời làm cho tổ chức (chịu ơn hoặc chịu thiệt) tình cờ xuất hiện — họ còn nhớ, theo cách của riêng họ; thái độ của họ tuỳ vào quá khứ cụ thể giữa hai bên.',
    ],
  },
  police: {
    weight: 15,
    seeds: [
      'Đồng nghiệp/cấp trên nhắn nhờ một việc nghiệp vụ lặt vặt ở {area}: xác minh một tin báo nhỏ, dán thông báo đề phòng — công việc thật của ngành, không phim ảnh.',
      'Người dân nhận ra "người của pháp luật" và tới trình bày một khiếu nại rất đời (mất trộm vặt, hàng xóm cãi nhau vì Pokémon phá vườn) — xử tại chỗ hay hướng dẫn lên trạm là lựa chọn.',
      'Một chi tiết nhỏ ở {area} không khớp với bản tin nội bộ tuần này — nhỏ tới mức ghi chú lại cũng thấy mình hơi vẽ chuyện. Nhưng nghề dạy rằng cái gợn nhỏ hay có đuôi dài.',
      'Một cựu đồng nghiệp/tiền bối của ngành giờ đã ra ngoài làm bảo vệ tư tình cờ chạm mặt — câu chuyện của họ về lý do rời ngành đáng nghe hơn vẻ ngoài.',
    ],
  },
  medic: {
    weight: 15,
    seeds: [
      'Một trainer bế Pokémon bị thương nhẹ chạy tới vì thấy người chơi "trông có nghề" — ca đơn giản, nhưng chủ nhân thì hoảng gấp mười con Pokémon.',
      'Trung tâm Pokémon gần {area} đang quá tải nhẹ (mùa di cư, sau một giải đấu) — có lời hỏi mượn tay nghề vài tiếng, trả công bằng cơm và ơn nghĩa.',
      'Người chơi để ý một Pokémon quanh đây có dấu hiệu bệnh/kiệt sức mà chính chủ nó chưa nhận ra — nói hay không, nói thế nào, là cái khéo của nghề.',
    ],
  },
  breeder: {
    weight: 14,
    seeds: [
      'Một khách hỏi han về giống Pokémon với mớ hiểu lầm ngây ngô về huyết thống — cơ hội chỉ dạy tận tâm hoặc một thương vụ nhỏ tử tế.',
      'Con mắt nhà nghề của người chơi bắt được một Pokémon quanh {area} có phẩm chất dòng giống hiếm thấy — chuyện đáng ghi vào sổ nghề.',
      'Giới trong nghề đang xì xào về một trại giống làm ăn bẩn đâu đó trong {region} — mới là chuyện nghề, chưa phải chuyện mình, trừ khi mình muốn nó thành chuyện mình.',
    ],
  },
  league: {
    weight: 14,
    seeds: [
      'Lịch một giải giao hữu/vòng loại nhỏ gần {area} vừa được dán lên bảng tin — đăng ký, đi xem học hỏi, hay lướt qua đều là lựa chọn hợp lệ.',
      'Một gương mặt quen của giới thi đấu địa phương đi ngang với việc riêng của họ — thế giới thi đấu vẫn quay dù mình đứng ngoài.',
      'Ai đó nhận ra gốc gác thi đấu/gym của người chơi và muốn hỏi han hoặc so kè đôi câu — tôn trọng có, tò mò có, ganh đua nhẹ cũng có.',
    ],
  },
  media: {
    weight: 14,
    seeds: [
      'Một chuyện nhỏ đáng đưa tin xảy ra ngay trước mắt ở {area} — ghi lại hay bỏ qua là lựa chọn nghề; và người trong cuộc chưa chắc muốn lên mặt báo.',
      'Toà soạn/khách hàng nhắn cần một bài/bộ ảnh chủ đề {region} trước cuối tuần — deadline là thứ có thật và không quan tâm cảm xúc.',
      'Một nguồn tin lạ chủ động bắt chuyện: "muốn có chuyện hay không?" — nguồn tin tự tìm tới thường có giá của nó, trả bằng gì thì chưa biết.',
    ],
  },
  performer: {
    weight: 14,
    seeds: [
      'Một góc phố {area} đông người qua lại đang trống — chỗ diễn đẹp nếu dựng màn nhanh trước khi người khác chiếm; quản lý trật tự khu này tính nết ra sao thì chưa rõ.',
      'Một khán giả nhí kéo tay xin xem lại "trò hôm trước" — tiếng lành đồn xa theo cách nhỏ bé nhất của nó.',
      'Ban tổ chức một sự kiện địa phương đang thiếu tiết mục lấp giờ — cát-xê mỏng, sân khấu thật, khán giả thật.',
    ],
  },
  merchant: {
    weight: 14,
    seeds: [
      'Chênh lệch giá một mặt hàng giữa {area} và vùng lân cận lọt vào mắt nhà nghề — chuyến hàng nhỏ có lời nếu nhanh chân và tính đúng đường.',
      'Một mối quen báo có lô hàng cần người trung chuyển tin cậy — nghe thì sạch, nhưng nghề dạy: hàng gì, của ai, đi đâu — hỏi đủ ba câu rồi hẵng gật.',
      'Phiên chợ {area} có một quầy lạ bán đồ khó đoán nguồn gốc — dân buôn nhìn là thấy gợn; báo, tránh, hay dò giá là ba con đường khác nhau.',
    ],
  },
  laborer: {
    weight: 13,
    seeds: [
      'Có người thuê một ngày công đúng nghề cũ của người chơi ở {area} — tiền tươi, việc thật, mồ hôi thật.',
      'Một người làm cùng cảnh bắt chuyện hỏi han quê quán, đường đi nước bước — dân lao động nhận ra nhau nhanh lắm.',
      'Đồ nghề/máy móc của ai đó gần đây trục trặc đúng thứ người chơi biết sửa — cơ hội ghi điểm kiểu rất đời, không kèn không trống.',
    ],
  },
  clan: {
    weight: 16,
    seeds: [
      'Một bức thư nhà / quản gia của gia tộc tìm tới {area} đưa tin: các trưởng bối đang BÀN chuyện hứa hôn/liên hôn cho người chơi với một gia tộc môn đăng hộ đối — mới chỉ là tin bay tới, người chơi có toàn quyền phản ứng (phản đối, hoãn binh, dò hỏi, mặc kệ), KHÔNG bị ép cưới ngay trong cảnh.',
      'Người của một gia tộc đối địch xuất hiện gần đó — chỉ quan sát và buông một câu xã giao có gai, phép tắc đầy đủ, chưa gây hấn.',
      'Gia tộc gửi một "nhờ vả nhỏ" mang tính kỳ vọng (ghé thăm một trưởng lão, thay mặt dự một buổi lễ địa phương) — làm hay không đều có hệ quả xã giao nhẹ, không có đúng sai tuyệt đối.',
      'Một người nhận ra gia huy/danh tiếng gia tộc của người chơi — thái độ của họ đổi khác (kính nể, dè chừng, hoặc muốn lợi dụng), tuỳ người.',
      'Một người em họ/chi thứ trong tộc lén tìm tới nhờ giúp một chuyện khó nói với các trưởng bối.',
      'Tin đồn trong giới quyền quý: đối tượng được nhắm hứa hôn với người chơi hoá ra cũng... không muốn cuộc hôn sự này — một khả năng đồng minh bất ngờ.',
    ],
  },
  street: {
    weight: 16,
    seeds: [
      'Người chơi nhận ra một ánh mắt NGHIỆP VỤ lướt qua mình — một investigator/cảnh sát ngầm đang ở {area} vì việc riêng của họ; họ MỚI CHỈ để mắt, chưa hành động, và người chơi chưa chắc là mục tiêu.',
      'Một người quen cũ trong giới nhắn tin/nhờ chuyển lời: cần vay ít tiền, hoặc "có chuyện muốn nói" — thật giả lẫn lộn.',
      'Nghe phong thanh một ân oán cũ biết người chơi đang ở {region} — mới chỉ là gió thổi tới, còn thời gian để chuẩn bị hoặc phớt lờ.',
      'Một đàn em/bạn cũ đang gặp rắc rối nhỏ ở khu này và bắn tin cầu cứu — giúp hay không là lựa chọn thật, đều có hệ quả riêng.',
      'Một lời mời "phi vụ" mập mờ tìm tới qua trung gian — tiền ổn, chi tiết mờ; từ chối được, và từ chối khéo còn giữ được quan hệ.',
      'Chủ một cửa hàng có "cửa sau" trong giới nhận ra người chơi, ngầm ra hiệu có hàng/tin tức riêng cho người trong nghề.',
    ],
  },
  scholar: {
    weight: 14,
    seeds: [
      'Phòng nghiên cứu nhắn nhờ ghi nhận một hiện tượng đang xảy ra quanh {area} (hành vi lạ của một loài, dữ liệu thời tiết) — việc nhỏ, đúng chuyên môn.',
      'Người chơi tự nhận ra một chi tiết bất thường đáng ghi chép về Pokémon bản địa mà người thường sẽ bỏ qua.',
      'Một nhà nghiên cứu khác (đồng nghiệp/đối thủ học thuật ôn hoà) cũng đang ở khu này vì cùng một câu hỏi.',
    ],
  },
  ranger: {
    weight: 14,
    seeds: [
      'Dấu hiệu một Pokémon hoang dã bị thương gần {area} — theo nghiệp vụ kiểm lâm thì nên xem xét, nhưng ưu tiên thế nào là quyền người chơi.',
      'Vết tích khả nghi của săn trộm (bẫy cũ, dấu xe lạ) — mới chỉ là dấu vết nguội, đủ để lưu tâm chứ chưa phải đối đầu.',
      'Trạm kiểm lâm địa phương nhờ chuyển giúp một kiện hàng/lời nhắn tới trạm kế — tiện đường thì giúp.',
    ],
  },
  wanderer: {
    weight: 8,
    seeds: [
      'Một khoảnh khắc "tự do đúng nghĩa": không ai cần gì ở người chơi cả — chính người chơi (và Pokémon) được chọn hôm nay là ngày như thế nào.',
      'Ai đó hỏi người chơi câu hỏi mà trainer trẻ nào cũng bị hỏi: "Định đi tới đâu, để làm gì?" — một dịp để nhân vật tự soi mục tiêu của mình.',
    ],
  },
}

// ---------- QUY TẮC CÔNG BẰNG (bọc quanh MỌI hạt giống) ----------
const FAIRNESS_RULES =
  'QUY TẮC BẮT BUỘC khi triển khai: (1) đây là GỢI Ý — chỉ lồng vào nếu hợp mạch truyện hiện tại, lồng TỰ NHIÊN trong 1-2 tin tới chứ không cần ngay lập tức, đang giữa cao trào khác thì BỎ QUA hẳn; (2) tình huống phải có nhiều lối ra — người chơi được quyền từ chối/phớt lờ và thế giới vẫn tiếp diễn bình thường, KHÔNG dồn ép vào ngõ cụt; (3) KHÔNG nịnh người chơi, không cho người chơi "ngầu" miễn phí — NPC phản ứng theo đúng logic và lợi ích riêng của họ, thành quả chỉ đến từ hành động thật; (4) không nhắc tới ghi chú này trong lời kể.'

// ---------- CHỈ DẪN THẾ GIỚI SỐNG (cố định trong system prompt) ----------
export const DIRECTOR_WORLD_INSTRUCTION = `NGUYÊN TẮC THẾ GIỚI SỐNG (áp dụng xuyên suốt):
- Thế giới KHÔNG xoay quanh người chơi: NPC có việc riêng, lịch riêng, ham muốn riêng; sự kiện nền vẫn diễn ra dù người chơi không tham gia.
- Nhịp truyện đa dạng: không phải lúc nào cũng chiến đấu — đời thường, xã giao, khám phá, cảm xúc đều đáng kể ngang trận đấu.
- CÂN BẰNG tuyệt đối: không tạo tình huống dồn người chơi vào ngõ cụt không lối thoát; ngược lại cũng KHÔNG tâng bốc, không để NPC trầm trồ vô cớ, không "aura" miễn phí — tôn trọng người chơi bằng cách để hành động của họ tự nói.
- Tổ chức phản diện của vùng hiện diện MỜ như phông nền: thi thoảng một tín hiệu nhỏ, gián tiếp; tuyệt đối không lộ liễu, không tự đẩy thành đối đầu khi người chơi chưa chủ động đào sâu.
- Tôn trọng quyền chủ động: gợi mở tình huống chứ không ép; lựa chọn nào của người chơi cũng dẫn truyện đi tiếp được.`

// ---------- CÀI ĐẶT + TRẠNG THÁI NHỊP ĐỘ ----------
const SETTINGS_KEY = 'trainer-arena:director-settings'
const STATE_KEY = 'trainer-arena:director-state'

// intensity: 'off' | 'sparse' | 'normal' | 'dense'
const INTENSITY = {
  off: null,
  sparse: { cooldown: 7, base: 0.22, ramp: 0.08, cap: 0.7 },
  normal: { cooldown: 4, base: 0.35, ramp: 0.12, cap: 0.85 },
  dense: { cooldown: 2, base: 0.5, ramp: 0.15, cap: 0.95 },
}

let settings = null
let state = null
const listeners = new Set()

function loadSettings() {
  if (settings) return settings
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null
    if (saved) {
      const p = JSON.parse(saved)
      settings = { intensity: p.intensity ?? 'normal', romance: p.romance !== false }
      return settings
    }
  } catch { /* làm mới */ }
  settings = { intensity: 'normal', romance: true }
  return settings
}

function loadState() {
  if (state) return state
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STATE_KEY) : null
    if (saved) {
      const p = JSON.parse(saved)
      state = { lastNudgeTurn: p.lastNudgeTurn ?? -999, recentCats: p.recentCats ?? [] }
      return state
    }
  } catch { /* làm mới */ }
  state = { lastNudgeTurn: -999, recentCats: [] }
  return state
}

function persistSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* ignore */ }
}
function persistState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}
function notify() {
  for (const fn of listeners) {
    try { fn() } catch { /* ignore */ }
  }
}

export function subscribeDirector(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function getDirectorSettings() {
  return { ...loadSettings() }
}
export function setDirectorSettings(next) {
  settings = { ...loadSettings(), ...next }
  persistSettings()
  notify()
}
/** Truyện mới → reset nhịp (giữ nguyên cài đặt). */
export function resetDirectorState() {
  state = { lastNudgeTurn: -999, recentCats: [] }
  persistState()
  notify()
}

// ---------- LÕI: chọn hạt giống ----------
function fillPlaceholders(seed, location) {
  const region = location ? getRegion(location.regionKey) : null
  const area = location ? getArea(location.regionKey, location.areaKey) : null
  return seed
    .replaceAll('{area}', area?.name ?? 'khu vực hiện tại')
    .replaceAll('{region}', region?.name ?? 'vùng này')
    .replaceAll('{villain}', region ? REGION_VILLAINS[region.key] ?? 'thế lực mờ ám địa phương' : 'thế lực mờ ám địa phương')
}

function weightedPick(entries, rng) {
  const total = entries.reduce((s, e) => s + e.weight, 0)
  let roll = rng() * total
  for (const e of entries) {
    roll -= e.weight
    if (roll <= 0) return e
  }
  return entries[entries.length - 1]
}

/**
 * Gọi mỗi lượt trước khi gửi cho AI. Trả về NOTE gợi ý tình huống (string)
 * hoặc null (đa số lượt là null — đó mới là tự nhiên).
 * @param {{identityKey: string, location: {regionKey,areaKey}|null, turn: number, rng?: () => number}} params
 */
export function maybeMakeNudge({ identityKey, location, turn, rng = Math.random }) {
  const st = loadSettings()
  const cfg = INTENSITY[st.intensity]
  if (!cfg) return null // 'off'

  const dstate = loadState()
  const sinceLast = turn - dstate.lastNudgeTurn
  if (sinceLast <= cfg.cooldown) return null
  const chance = Math.min(cfg.cap, cfg.base + cfg.ramp * (sinceLast - cfg.cooldown - 1))
  if (rng() >= chance) return null

  // Gom pool ứng viên: pool chung + pool thân phận; lọc romance tắt / pool
  // cần region khi chưa có vị trí / 2 loại vừa dùng gần nhất.
  const recent = new Set(dstate.recentCats)
  const candidates = []
  for (const [cat, pool] of Object.entries(POOLS)) {
    if (pool.toggleable && cat === 'romance' && !st.romance) continue
    if (pool.needsRegion && !location) continue
    if (recent.has(cat)) continue
    candidates.push({ cat, weight: pool.weight, seeds: pool.seeds })
  }
  // Đợt 32: 30 thân phận map về pool qua poolKey; thân phận TỰ TẠO ('custom')
  // dùng pool wanderer (tình huống trung tính) — mô tả riêng đã nằm trong
  // system prompt nên AI vẫn tự triển khai đúng chất thân phận đó.
  const poolKey = identityKey === 'custom' ? 'wanderer' : getIdentityV2(identityKey).poolKey
  const idPool = IDENTITY_POOLS[poolKey]
  if (idPool && !recent.has(`identity:${poolKey}`)) {
    candidates.push({ cat: `identity:${poolKey}`, weight: idPool.weight, seeds: idPool.seeds })
  }
  if (!candidates.length) return null

  const picked = weightedPick(candidates, rng)
  const seed = picked.seeds[Math.floor(rng() * picked.seeds.length)]

  // Cập nhật nhịp: nhớ 2 loại gần nhất để không lặp.
  state = {
    lastNudgeTurn: turn,
    recentCats: [picked.cat, ...dstate.recentCats].slice(0, 2),
  }
  persistState()
  notify()

  return [
    '[Hệ thống — ĐẠO DIỄN TÌNH HUỐNG (người chơi không thấy ghi chú này): một khả năng diễn biến cho thế giới xung quanh:]',
    fillPlaceholders(seed, location),
    FAIRNESS_RULES,
  ].join('\n')
}
