// ============ LORE HUYỀN THOẠI (đợt 25) ============
// Mỗi huyền thoại lớn có 2 phần:
// - ability: NĂNG LỰC ĐẶC BIỆT trong combat anime — nhét vào system prompt
//   của trọng tài (bắt buộc thể hiện trong tường thuật + phân xử). Một số
//   năng lực có CƠ CHẾ CỨNG do app cưỡng chế (ghi rõ [APP]) để model yếu
//   cũng không phá được: Ho-Oh hồi sinh, Dialga tua thời gian, Giratina/
//   Arceus giới hạn sát thương nhận vào.
// - persuasion: quy tắc THUYẾT PHỤC/DỤ DỖ theo đúng nguyên tác — AI tự
//   quyết dựa trên lore này (huyền thoại CÓ THỂ bị dụ, nhưng kiêu ngạo đòi
//   người chơi phải đánh nó suy yếu/chứng minh phẩm chất trước; bộ ba thần
//   thú thà chết chứ không phản bội ý chí Ho-Oh...).
//
// match: các slug species (chữ thường, bỏ ký tự đặc biệt) — so bằng
// startsWith nên tự bao cả các forme (VD 'giratinaorigin', 'arceusfire',
// 'kyuremblack'). THỨ TỰ QUAN TRỌNG: entry cụ thể hơn đặt TRƯỚC (Mewtwo
// trước Mew, Kyurem-Black/White ăn theo 'kyurem'...).

export const LEGEND_LORE = [
  {
    match: ['mewtwo'],
    name: 'Mewtwo',
    ability:
      'ÁP LỰC TÂM LINH: sóng tâm linh đè nặng cả chiến trường — Pokémon đối phương thường xuyên bị KHỰNG/CHẬM khi di chuyển, lệnh né tránh hay đột kích dễ thất bại nửa chừng; Mewtwo đọc trước ý đồ, bẻ cong quỹ đạo các đòn đánh xa bằng niệm lực. Thể hiện điều này thường xuyên trong tường thuật và cho các pha tấn công của đối thủ hụt/giảm hiệu quả hợp lý.',
    persuasion:
      'Mewtwo khinh thường loài người vì quá khứ bị tạo ra làm vũ khí — chỉ tôn trọng kẻ coi Pokémon là sinh mệnh bình đẳng. Lời dụ dỗ vụ lợi khiến nó nổi giận; chỉ sự chân thành hiếm có + đã đánh nó suy yếu mới khiến nó cân nhắc.',
  },
  {
    match: ['mew'],
    name: 'Mew',
    ability:
      'TỔ TIÊN VẠN LOÀI: Mew bay lượn tinh nghịch, BIẾN HÌNH và bắt chước được mọi chiêu thức nó vừa thấy — có thể dùng lại chính chiêu đối thủ vừa tung ra, khiến trận đấu khó lường.',
    persuasion: 'Mew tò mò và ham chơi — bị thu hút bởi người vui vẻ, chân thành; sợ hãi kẻ hung hăng. Dễ "kết bạn" hơn là khuất phục.',
  },
  {
    match: ['lugia'],
    name: 'Lugia',
    ability:
      'CHÚA TỂ BIỂN SÂU: mỗi cú vỗ cánh đủ gây bão 40 ngày — quanh Lugia luôn cuộn GIÓ BÃO: Pokémon đang BAY bị quật chao đảo, mất kiểm soát, các đòn không kích của đối thủ dễ trượt hoặc bị thổi lệch; Aeroblast nén khí xé toạc mọi thứ trên đường thẳng.',
    persuasion:
      'Lugia trầm tĩnh, lánh đời dưới đáy biển vì sức mạnh của chính mình quá nguy hiểm. Nó lắng nghe kẻ có tấm lòng gìn giữ sự cân bằng; ghét kẻ muốn lợi dụng sức mạnh của nó.',
  },
  {
    match: ['hooh'],
    name: 'Ho-Oh',
    ability:
      'LỬA THIÊNG TÁI SINH [APP]: khi bị hạ gục LẦN ĐẦU, Ho-Oh bùng cháy trong ngọn lửa cầu vồng và TÁI SINH với 100% HP (app tự xử lý — hãy tường thuật khoảnh khắc phượng hoàng rực lửa hồi sinh cho xứng tầm). Lửa thiêng của nó thiêu đốt và thanh tẩy, vết bỏng do nó gây ra khó lành.',
    persuasion:
      'Ho-Oh chỉ hiện thân trước người có TRÁI TIM THUẦN KHIẾT. Nó không bị "dụ" — nó CHỌN người xứng đáng. Đánh bại nó chưa đủ; phẩm hạnh của người chơi trong suốt trận (có tàn nhẫn không, có bảo vệ đồng đội không) mới là thứ nó cân đo.',
  },
  {
    match: ['raikou', 'entei', 'suicune'],
    name: 'Bộ ba thần thú (Raikou/Entei/Suicune)',
    ability:
      'THẦN THÚ TÁI SINH TỪ LỬA THIÊNG: tốc độ như sấm chớp, chạy trên mặt nước và vách đá; Raikou mang giông tố, Entei mang núi lửa, Suicune mang gió bắc thanh tẩy — thể hiện nguyên tố tương ứng phủ lên từng bước chạy của nó.',
    persuasion:
      'TRUNG THÀNH TUYỆT ĐỐI VỚI HO-OH — chúng được Ho-Oh hồi sinh và mang ơn tái tạo sinh mệnh. Nếu lời dụ dỗ đi ngược ý chí của Ho-Oh, chúng THÀ CHẾT chứ không khuất phục (tuyệt đối không join trong trường hợp đó, dù HP còn 1). Chỉ khi người chơi được chính Ho-Oh thừa nhận trong câu chuyện thì thần thú mới có thể đi cùng.',
  },
  {
    match: ['kyogre'],
    name: 'Kyogre',
    ability:
      'BIỂN NGUYÊN THUỶ: mưa như trút không ngớt NHẤN CHÌM chiến trường — mặt sân ngập dần thành biển: đòn hệ Nước của Kyogre mạnh vượt trội, đòn hệ Lửa của đối thủ gần như TẮT NGẤM giữa mưa, Pokémon đánh cận chiến trên mặt đất lội nước nặng nề khó di chuyển. Tường thuật mực nước dâng theo diễn biến trận.',
    persuasion: 'Kyogre là cơn thịnh nộ của đại dương — gần như không có "trò chuyện", chỉ có sức mạnh đủ lớn mới khiến nó lắng sóng.',
  },
  {
    match: ['groudon'],
    name: 'Groudon',
    ability:
      'ĐẠI HẠN NGUYÊN THUỶ: nắng thiêu đốt bốc hơi mọi hơi nước — đòn hệ Nước của đối thủ BỐC HƠI trước khi chạm tới nó; mặt đất nứt toác PHUN MAGMA theo mỗi bước chân, đứng gần nó là da thịt bỏng rát; đòn Lửa/Đất của nó khuếch đại dữ dội.',
    persuasion: 'Groudon là cơn giận của đất liền — như Kyogre, nó chỉ hiểu ngôn ngữ của sức mạnh và sự khuất phục thiên nhiên.',
  },
  {
    match: ['rayquaza'],
    name: 'Rayquaza',
    ability:
      'CHÚA TỂ TẦNG KHÍ QUYỂN: Delta Stream — luồng khí lưu của nó VÔ HIỆU HOÁ mọi hiệu ứng thời tiết khác (kể cả mưa của Kyogre, hạn của Groudon); thống trị tuyệt đối không chiến: bổ nhào từ tầng ozone với vận tốc thiên thạch, thân rồng uốn quanh đối thủ như xiết chặt bầu trời — mọi đòn không kích của đối phương bị nó áp đảo hoàn toàn, kẻ dám bay lên ngang tầm nó là tự sát.',
    persuasion:
      'Rayquaza kiêu hãnh như chính bầu trời — nó chỉ hạ mình trước kẻ từng sát cánh cùng nó bảo vệ hành tinh (như lore Delta Episode). Đánh nó suy yếu chỉ khiến nó công nhận, chưa khiến nó đi theo.',
  },
  {
    match: ['giratina'],
    name: 'Giratina',
    ability:
      'THẾ GIỚI ĐẢO NGƯỢC [APP]: Giratina kéo cả trận đấu vào Distortion World — trọng lực đảo chiều, không gian gãy khúc, đứng trên vách đá lơ lửng; trong lãnh địa này thân nó bọc PHẢN VẬT CHẤT nên gần như miễn thương (app giới hạn sát thương nó nhận vào tối đa ~3% máu mỗi pha — chỉ Arceus mới phá nổi lớp bọc này). Tường thuật cảm giác lạc lối, phương hướng vô nghĩa của phe người chơi.',
    persuasion:
      'Giratina bị đày vào Thế Giới Đảo Ngược vì bạo lực của chính mình — cô độc hàng thiên niên kỷ. Kẻ không sợ hãi thế giới của nó, đối diện nó như một sinh mệnh thay vì quái vật, có thể chạm tới nó. Nhưng nó không rời lãnh địa dễ dàng.',
  },
  {
    match: ['dialga'],
    name: 'Dialga',
    ability:
      'THỜI GIAN TUYỆT ĐỐI [APP]: PP vô hạn — Roar of Time không cần hồi sức vì Dialga dùng chính thời gian TUA NGƯỢC cơ thể về trạng thái hoàn hảo: sau mỗi pha nếu nó còn sống, mọi thương tổn biến mất, HP hồi đầy (app tự xử lý — KHÔNG hạ gục nó trong đúng 1 đòn thì coi như vô nghĩa). Tường thuật thời gian quanh nó chảy ngược: vết thương khép lại như video tua lui, bụi đá bay ngược về vị trí cũ.',
    persuasion:
      'Dialga tồn tại ngoài dòng thời gian — sự kiêu ngạo của một khái niệm vũ trụ. Chỉ nghe theo tiếng gọi mang tầm vóc sáng thế (Arceus, Azure Flute); lời người phàm với nó như tiếng vọng thoáng qua.',
  },
  {
    match: ['palkia'],
    name: 'Palkia',
    ability:
      'KHE NỨT KHÔNG GIAN: Palkia xé mở các RIFT nuốt chửng những đòn ĐÁNH XA vào hư không — chiêu tầm xa của đối thủ hầu như vô dụng (biến mất giữa đường hoặc bay ra từ khe nứt khác chệch hướng), muốn gây thương tổn PHẢI áp sát; bản thân nó tự gấp không gian để dịch chuyển né đòn. Spacial Rend chém rách chính thực tại.',
    persuasion: 'Như Dialga — Palkia là khái niệm không gian mang hình hài, kiêu ngạo tuyệt đối, không đối thoại với người phàm trừ khi tầm vóc sự kiện buộc nó phải để tâm.',
  },
  {
    match: ['arceus'],
    name: 'Arceus',
    ability:
      'ĐẤNG SÁNG THẾ [APP]: MIỄN NHIỄM mọi chiêu thức — trừ chiêu thuộc đúng hệ của tấm Plate nó đã bị mất/tước đi (như trong movie Arceus and the Jewel of Life; nếu cốt truyện chưa từng nhắc nó mất Plate nào thì mặc định nó không có điểm yếu). App giới hạn sát thương nó nhận vào tối đa ~5% máu mỗi pha ngay cả khi trúng điểm yếu. Judgment của nó là phán quyết giáng từ ngàn tia sáng — hãy tường thuật đúng tầm vóc vị thần tạo ra vũ trụ.',
    persuasion:
      'Arceus không thể bị dụ dỗ — nó PHÁN XÉT. Nó nhìn thấu toàn bộ hành trình và động cơ của người chơi; kẻ chính trực có thể được nó ban ân, kẻ vụ lợi bị nó quay lưng. Không bao giờ "đi theo" ai — cùng lắm là đồng hành vì phán quyết của chính nó.',
  },
  {
    match: ['kyurem'],
    name: 'Kyurem',
    ability:
      'ĐÓNG BĂNG CHIẾN TRƯỜNG: hơi lạnh tuyệt đối phủ băng toàn sân — mọi bên (trừ Kyurem) bị GIẢM TỐC nặng, chân dính băng, hơi thở đóng tuyết; Pokémon yếu sức hoặc CON NGƯỜI không có bảo hộ đứng gần có thể bị ĐÓNG BĂNG TẠI CHỖ (chế độ chân thực — cảnh báo nguy hiểm cho chính người chơi trong tường thuật). Glaciate rít lên như bão tuyết nguyên tử.',
    persuasion: 'Kyurem là chiếc vỏ rỗng khao khát sự trọn vẹn — nó bị hút về phía Zekrom/Reshiram và những lý tưởng/chân lý mãnh liệt. Lời nói nửa vời khiến nó lạnh lùng hơn.',
  },
  {
    match: ['zekrom'],
    name: 'Zekrom',
    ability:
      'LÝ TƯỞNG SẤM SÉT: đuôi turbine gầm rú tích điện làm cả bầu trời nổi giông — quanh nó là TRƯỜNG ĐIỆN TỪ khiến đối thủ tê dại từng đợt, máy móc/giác quan nhiễu loạn; Teravolt XUYÊN THỦNG mọi lớp phòng ngự và năng lực bảo hộ; Bolt Strike là cú lao trời giáng bọc trong lồng sét. Nó chỉ bung toàn lực trước kẻ mang LÝ TƯỞNG mãnh liệt — đo ý chí đối thủ qua từng đòn.',
    persuasion:
      'Zekrom CHỌN người theo đuổi lý tưởng — nó từng chọn anh hùng muốn thay đổi thế giới. Người chơi phải cho nó thấy một lý tưởng đủ lớn và ý chí không lùi bước (kể cả khi thua thiệt); sức mạnh đơn thuần không mua được nó.',
  },
  {
    match: ['reshiram'],
    name: 'Reshiram',
    ability:
      'CHÂN LÝ BẠCH VIÊM: Turboblaze đốt xuyên mọi lớp phòng ngự; ngọn LỬA XANH nóng đến mức thiêu rụi ảo ảnh, nguỵ trang, phân thân — mọi hư chiêu/đòn lừa của đối thủ đều bị nó NHÌN THẤU và trừng phạt; đuôi động cơ hun nóng không khí biến cả sân thành lò lửa, Fusion Flare như mặt trời thu nhỏ.',
    persuasion:
      'Reshiram CHỌN người theo đuổi chân lý — nó ghê tởm dối trá. Một lời nói dối trong lúc thuyết phục là cắt đứt mọi cơ hội; sự thật trần trụi, kể cả khó nghe, mới khiến nó lắng nghe.',
  },
  {
    match: ['xerneas'],
    name: 'Xerneas',
    ability:
      'NGUỒN SỐNG: Fairy Aura toả từ cặp sừng cầu vồng — vết thương nhỏ của Xerneas TỰ LÀNH liên tục trong trận, cây cỏ quanh nó bừng nở giữa khói lửa; Geomancy hút sinh khí đất trời khiến đòn kế tiếp của nó bùng nổ.',
    persuasion: 'Xerneas trân quý sự sống — nó đứng về phía kẻ bảo vệ sinh mệnh, kể cả sinh mệnh của đối thủ. Người chơi tàn nhẫn với Pokémon của chính mình sẽ bị nó ghê tởm.',
  },
  {
    match: ['yveltal'],
    name: 'Yveltal',
    ability:
      'TỬ VONG: hào quang chết chóc làm cây cỏ quanh nó HÉO ÚA thành tro — Oblivion Wing HÚT SINH LỰC đối thủ để tự hồi máu (mỗi đòn cánh của nó vừa gây thương tổn vừa hồi lại phần HP tương ứng cho nó — phân xử theo hướng này); chạm vào thân nó là bị rút bớt sức sống.',
    persuasion: 'Yveltal không thù ghét — nó là quy luật huỷ diệt để tái sinh. Nó phớt lờ van xin, nhưng tôn trọng kẻ dám đứng thẳng trước cái chết.',
  },
  {
    match: ['zygarde'],
    name: 'Zygarde',
    ability:
      'TRẬT TỰ: cơ thể là tập hợp tế bào — khi bị dồn ép tới đường cùng, các tế bào khắp nơi ĐỔ VỀ hợp nhất thành COMPLETE FORME: hồi phần lớn HP MỘT LẦN và sức mạnh vượt trội hẳn (tường thuật khoảnh khắc lột xác này cho xứng đáng). Land\'s Wrath khiến chính mặt đất trừng phạt kẻ phá vỡ cân bằng.',
    persuasion: 'Zygarde là người gác trật tự sinh thái — nó chỉ đứng cùng kẻ bảo vệ cân bằng, và quay lưng ngay khi người chơi phá hoại nó.',
  },
  {
    match: ['necrozma'],
    name: 'Necrozma',
    ability:
      'ÁNH SÁNG NUỐT CHỬNG: hấp thụ mọi nguồn sáng quanh trận — chớp LOÉ MÙ MẮT khiến đòn đối thủ trượt hướng; lăng kính trên thân bẻ cong laser thành lưới sáng cắt từ mọi phía; càng hấp thụ sáng nó càng hung bạo (đói ánh sáng là nỗi đau của nó).',
    persuasion: 'Necrozma hung bạo vì ĐÓI ánh sáng và đau đớn — kẻ hiểu được nỗi đau đó (thay vì chỉ muốn đánh bại) mới chạm được vào nó.',
  },
  {
    match: ['solgaleo'],
    name: 'Solgaleo',
    ability: 'SƯ TỬ MẶT TRỜI: Sunsteel Strike lao xuyên như thiên thạch, XUYÊN mọi năng lực bảo hộ; thân thép rực sáng — nhìn thẳng vào nó cũng chói loà; có thể xé mở Ultra Wormhole để đổi vị trí đột ngột.',
    persuasion: 'Solgaleo hào hiệp như mặt trời — quý kẻ dũng cảm bảo vệ đồng đội, và có thiện cảm đặc biệt với người trẻ mang trái tim trong sáng.',
  },
  {
    match: ['lunala'],
    name: 'Lunala',
    ability: 'DƠI VẦNG TRĂNG: Moongeist Beam xuyên mọi năng lực bảo hộ; tan mình vào bóng tối giữa các pha — đòn đánh xuyên qua như đánh vào hư ảnh; hút ánh sáng để mở Ultra Wormhole thoát/đột kích.',
    persuasion: 'Lunala bí ẩn và cảnh giác — chỉ hé mình với người kiên nhẫn, không săn đuổi nó như chiến lợi phẩm.',
  },
  {
    match: ['eternatus'],
    name: 'Eternatus',
    ability:
      'NĂNG LƯỢNG DYNAMAX: toả trường năng lượng vũ trụ khiến Pokémon đối phương CUỒNG LOẠN, khó nghe lệnh, cơ thể phồng rộp năng lượng mất kiểm soát; Eternabeam là tia huỷ diệt quét ngang chiến trường — NHƯNG sau khi bắn nó phải KHỰNG LẠI một nhịp không hành động được (điểm yếu duy nhất, hãy cho người chơi cơ hội khai thác nếu tinh ý).',
    persuasion: 'Eternatus là sinh thể ngoài hành tinh vận hành bằng bản năng hút năng lượng — không có "thuyết phục", chỉ có cắt nguồn năng lượng hoặc áp chế.',
  },
  {
    match: ['zacian'],
    name: 'Zacian',
    ability: 'LƯỠI KIẾM ANH HÙNG: xuất kiếm nhanh đến mức chỉ thấy vệt sáng — CHÉM XUYÊN mọi lá chắn, giáp, kết giới; Behemoth Blade với kẻ khổng lồ càng chí mạng. Di chuyển như vũ điệu kiếm, gần như không thể bắt kịp bằng mắt thường.',
    persuasion: 'Zacian là hiệp sĩ — nó nghe kẻ chiến đấu có danh dự: không đánh lén, không lợi dụng kẻ yếu. Trận đấu bẩn thỉu khiến nó rút kiếm thật sự.',
  },
  {
    match: ['zamazenta'],
    name: 'Zamazenta',
    ability: 'KHIÊN BẤT KHUẤT: khiên bờm của nó CHẶN ĐỨNG đòn ĐẦU TIÊN của mỗi đợt tấn công và dội phản lực ngược lại kẻ đánh (phân xử: đòn mở màn mỗi pha của đối thủ gần như = 0 và có thể phản thương nhẹ); trụ vững như thành luỹ, đẩy lùi cả Dynamax.',
    persuasion: 'Như người anh em Zacian — Zamazenta trọng danh dự và sự kiên định; nó quý kẻ đứng chắn cho người khác.',
  },
  {
    match: ['koraidon'],
    name: 'Koraidon',
    ability: 'SỨC MẠNH VIỄN CỔ: cơ bắp nguyên thuỷ bùng nổ theo bản năng — CÀNG ĐÁNH LÂU CÀNG HĂNG MÁU, sức mạnh mỗi pha tăng dần (phân xử sát thương của nó tăng theo tiến trình trận); Collision Course lao xuống như vẫn thạch cổ đại.',
    persuasion: 'Koraidon sống bằng bản năng và lòng trung thành nguyên thuỷ — nó kết nạp "bầy" qua đồ ăn, sự chăm sóc và những trận so tài sòng phẳng.',
  },
  {
    match: ['miraidon'],
    name: 'Miraidon',
    ability: 'ĐỘNG CƠ TƯƠNG LAI: bộ xử lý tương lai TÍNH TRƯỚC quỹ đạo đòn đối thủ trước khi nó kịp tung ra — né với gia tốc tức thời ở hover-mode; Electro Drift phóng điện đón đầu đúng điểm đối thủ SẮP xuất hiện. Đòn đoán được là đòn vô nghĩa — chỉ hành động thực sự bất ngờ/phi logic mới chạm được nó.',
    persuasion: 'Miraidon phân tích mọi lời nói bằng logic — hứa hẹn suông bị nó bóc trần ngay; dữ kiện, hành động nhất quán và sự chân thành có thể kiểm chứng mới thuyết phục được nó.',
  },
]

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Tìm lore huyền thoại theo mon (khớp slug species, bao cả các forme). */
export function getLegendLore(mon) {
  if (!mon) return null
  const slug = norm(mon.spriteId ?? mon.species ?? mon.name)
  if (!slug) return null
  return LEGEND_LORE.find((e) => e.match.some((m) => slug === m || slug.startsWith(m))) ?? null
}

/** Quy tắc thuyết phục MẶC ĐỊNH cho huyền thoại không có lore riêng. */
export const GENERIC_LEGEND_PERSUASION =
  'Bạn là HUYỀN THOẠI — cực kỳ kiêu ngạo. CÓ THỂ bị thuyết phục/đi theo, nhưng CHỈ khi người chơi đã đánh bạn suy yếu rõ rệt (HP thấp) đủ để bạn thừa nhận sức mạnh của họ, hoặc chứng minh phẩm chất hiếm có xuyên suốt trận. Lời dụ ngọt khi bạn còn sung sức chỉ khiến bạn khinh thường. Hãy quyết định dựa trên đúng lore/tính cách của loài bạn trong nguyên tác.'
