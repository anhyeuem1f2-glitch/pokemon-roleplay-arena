// ============ 30 THÂN PHẬN (đợt 32) ============
// Tông REALISTIC / Pokémon Special: thế giới Pokémon là một xã hội thật —
// có sinh kế, giấy phép, cảnh sát, và TỘI PHẠM THẬT SỰ (buôn lậu Pokémon,
// săn trộm, bảo kê) chứ không phải phản diện tấu hài. Thân phận không phải
// "class RPG" — nó là XUẤT PHÁT ĐIỂM xã hội, quyết định pool tình huống của
// Đạo diễn (poolKey → IDENTITY_POOLS trong storyDirector.js) và cách thế
// giới nhìn nhân vật.
//
// Người chơi cũng có thể TỰ TẠO thân phận (customIdentity trong
// playerCharacter) — khi đó poolKey mặc định 'wanderer' và mô tả tự viết
// được đưa thẳng vào prompt.

export const IDENTITIES_V2 = [
  // ---- Dân thường / khởi đầu mở ----
  { key: 'wanderer', poolKey: 'wanderer', name: 'Tân binh tự do', desc: 'Một người trẻ bình thường vừa đủ tuổi lấy giấy phép trainer — không ràng buộc, không tài sản, mọi thứ phía trước.' },
  { key: 'farmhand', poolKey: 'laborer', name: 'Làm thuê nông trại Pokémon', desc: 'Lớn lên giữa chuồng trại Miltank và ruộng berry — quen lao động tay chân, hiểu Pokémon theo kiểu nhà nông chứ không qua sách vở.' },
  { key: 'fisher', poolKey: 'laborer', name: 'Dân chài', desc: 'Con nhà thuyền chài ven biển: dậy trước bình minh, đọc được sóng gió, và biết biển nuôi người nhưng cũng lấy đi người.' },
  { key: 'miner', poolKey: 'laborer', name: 'Con nhà thợ mỏ', desc: 'Sinh ra ở thị trấn mỏ: bụi than, đèn lò, những đường hầm có Pokémon đá làm bạn lẫn làm hoạ. Hiểu giá trị của một ngày công.' },
  { key: 'orphan', poolKey: 'laborer', name: 'Trẻ mồ côi tự lập', desc: 'Lớn lên trong trại trẻ, quen tự xoay xở từ nhỏ. Không có gì để mất và cũng chẳng ai đứng sau — mọi thứ phải tự tay giành lấy.' },

  // ---- Gia tộc / quyền quý ----
  { key: 'clan', poolKey: 'clan', name: 'Con cháu đại gia tộc', desc: 'Hậu duệ một gia tộc trainer danh giá: tiền bạc và quan hệ mở mọi cánh cửa, nhưng hôn ước, lễ nghi và kỳ vọng của trưởng bối cũng khoá chặt không kém.' },
  { key: 'clan-fallen', poolKey: 'clan', name: 'Hậu duệ gia tộc sa sút', desc: 'Mang họ của một gia tộc từng lừng lẫy nay chỉ còn cái vỏ: danh tiếng cũ vừa là vốn liếng vừa là món nợ, và không thiếu kẻ muốn thấy cái tên này chìm hẳn.' },
  { key: 'elite-child', poolKey: 'league', name: 'Con của trainer nổi tiếng', desc: 'Cha/mẹ là gương mặt cả vùng biết tới. Đi tới đâu cũng bị so sánh — cái bóng đó là bệ phóng hay gông cùm là tuỳ mình.' },

  // ---- Giới xám / tội phạm (tông nghiêm túc) ----
  { key: 'street', poolKey: 'street', name: 'Giang hồ đường phố', desc: 'Lớn lên trong giới ngầm đô thị: biết cửa sau của thành phố, nợ vài ân tình khó trả, và hồ sơ đủ dày để giới điều tra thi thoảng liếc qua.' },
  { key: 'crime-runner', poolKey: 'criminal', name: 'Chân chạy vặt cho tổ chức', desc: 'Từng (hoặc đang) nhận việc lặt vặt cho một tổ chức tội phạm thật sự — chuyển hàng không hỏi bên trong, canh đường, nghe ngóng. Tiền sạch thì ít, đường lui thì hẹp dần.' },
  { key: 'ex-grunt', poolKey: 'criminal', name: 'Cựu thành viên tổ chức đang rửa tay', desc: 'Đã rời một tổ chức tội phạm và đang cố sống sạch — nhưng tổ chức không thích người biết quá nhiều tự do đi lại, và cảnh sát cũng chưa quên cái tên này.' },
  { key: 'smuggler-child', poolKey: 'criminal', name: 'Con nhà buôn lậu Pokémon', desc: 'Gia đình làm nghề mà không ai dám ghi lên giấy: mua bán Pokémon ngoài luồng. Lớn lên giữa những chuyến hàng đêm và những cái nhìn tránh né của hàng xóm.' },
  { key: 'informant', poolKey: 'criminal', name: 'Chỉ điểm hai mang', desc: 'Bán tin cho cả giới ngầm lẫn cảnh sát để sống. Ai cũng cần mình và không ai tin mình — một nghề đi trên dây, ngã bên nào cũng đau.' },
  { key: 'poacher-turned', poolKey: 'criminal', name: 'Cựu phụ việc săn trộm hoàn lương', desc: 'Từng theo đoàn săn trộm Pokémon vì miếng ăn, nay quay lưng với nghề cũ. Hiểu bẫy, hiểu đường dây tiêu thụ — thứ kiến thức mà cả kiểm lâm lẫn kẻ xấu đều thèm.' },

  // ---- Thực thi pháp luật ----
  { key: 'police-trainee', poolKey: 'police', name: 'Học viên cảnh sát', desc: 'Đang trong kỳ thực địa của học viện cảnh sát: đồng phục còn mới, lý tưởng còn nguyên, và sắp học ra rằng luật trên giấy khác luật ngoài đường.' },
  { key: 'police-family', poolKey: 'police', name: 'Con nhà cảnh sát', desc: 'Cả nhà mấy đời làm cảnh sát địa phương. Được dạy nhìn đâu cũng thấy quy trình — và cũng thấy những vụ án bố mẹ không bao giờ kể hết ở bàn ăn.' },
  { key: 'intl-police-aide', poolKey: 'police', name: 'Trợ lý tập sự Cảnh sát Quốc tế', desc: 'Chân giấy tờ cho một văn phòng Cảnh sát Quốc tế: toàn việc bàn giấy, nhưng những hồ sơ đi ngang qua bàn hé ra một thế giới ngầm lớn hơn mọi bản tin.' },

  // ---- Kiểm lâm / tự nhiên ----
  { key: 'ranger', poolKey: 'ranger', name: 'Kiểm lâm tập sự', desc: 'Học việc trong lực lượng kiểm lâm: tuần rừng, gỡ bẫy, cứu hộ Pokémon hoang — và đối mặt với thực tế rằng săn trộm là một NGÀNH, không phải vài kẻ lẻ tẻ.' },
  { key: 'park-warden', poolKey: 'ranger', name: 'Phụ việc khu bảo tồn', desc: 'Làm công trong một khu bảo tồn Pokémon: cho ăn, dọn chuồng, ghi sổ sức khoẻ — gần Pokémon hơn bất kỳ ai, theo cách chẳng hào nhoáng chút nào.' },

  // ---- Học thuật ----
  { key: 'scholar', poolKey: 'scholar', name: 'Trợ lý nghiên cứu', desc: 'Chân sai vặt có lương của một phòng nghiên cứu Pokémon: nhập liệu, rửa ống nghiệm, đi thực địa — và thi thoảng thấy dữ liệu không khớp với những gì giáo sư công bố.' },
  { key: 'archaeologist', poolKey: 'scholar', name: 'Học việc khảo cổ', desc: 'Theo các đoàn khai quật di tích: phần lớn thời gian là phủi bụi và khuân đồ, nhưng những phiến đá khắc Pokémon cổ đôi khi kể chuyện mà sách sử im lặng.' },

  // ---- Y tế ----
  { key: 'nurse-trainee', poolKey: 'medic', name: 'Thực tập sinh trung tâm Pokémon', desc: 'Ca kíp ở trung tâm Pokémon: băng bó, trực đêm, an ủi trainer khóc ngoài phòng cấp cứu. Thấy mặt trái của những trận đấu mà khán giả không thấy.' },
  { key: 'field-medic', poolKey: 'medic', name: 'Cứu hộ dã chiến', desc: 'Thành viên tập sự đội cứu hộ vùng hoang dã: bão, lở đất, trainer non tay gặp nạn — nghề chạy VỀ PHÍA rắc rối trong khi mọi người chạy ra.' },

  // ---- Liên đoàn / thi đấu ----
  { key: 'gym-trainee', poolKey: 'league', name: 'Đệ tử gym', desc: 'Ăn ngủ tại một gym địa phương: lau sàn, xếp lịch, làm bao cát cho khách thách đấu — đổi lấy từng buổi được sư phụ chỉ dạy thật sự.' },
  { key: 'league-dropout', poolKey: 'league', name: 'Thí sinh liên đoàn bỏ dở', desc: 'Từng đi thi đấu liên đoàn và dừng lại giữa chừng — vì thua, vì tiền, hay vì chuyện không kể được. Giờ quay lại con đường cũ với đôi mắt khác.' },

  // ---- Truyền thông ----
  { key: 'journalist', poolKey: 'media', name: 'Phóng viên tập sự', desc: 'Chân chạy tin cho một tờ báo địa phương: đưa tin lễ hội, tai nạn, giải đấu — và học dần rằng những tin bị gác lại mới là tin đáng đọc.' },
  { key: 'photographer', poolKey: 'media', name: 'Nhiếp ảnh gia hoang dã', desc: 'Sống bằng ảnh Pokémon hoang: phục kích hàng giờ trong bụi rậm cho một khoảnh khắc. Ống kính đôi khi bắt được thứ không nên bắt.' },

  // ---- Biểu diễn / dịch vụ ----
  { key: 'performer', poolKey: 'performer', name: 'Nghệ sĩ đường phố cùng Pokémon', desc: 'Kiếm sống bằng những màn diễn nhỏ cùng Pokémon trên phố: ngày đông khách thì no, ngày mưa thì đói — sân khấu là vỉa hè và khán giả là người qua đường.' },
  { key: 'merchant', poolKey: 'merchant', name: 'Con nhà thương lái rong', desc: 'Nhà buôn chuyến theo mùa giữa các thị trấn: biết giá của mọi thứ, quen mặt mọi chợ, hiểu rằng thông tin là món hàng lời nhất.' },
  { key: 'breeder', poolKey: 'breeder', name: 'Con nhà trại nhân giống', desc: 'Gia đình làm nghề nhân giống Pokémon có giấy phép: hiểu huyết thống, tính nết từng dòng — và ghét cay ghét đắng đám buôn lậu làm bẩn nghề.' },
]

/** Tra thân phận theo key — không thấy thì fallback tân binh tự do. */
export function getIdentityV2(key) {
  return IDENTITIES_V2.find((i) => i.key === key) ?? IDENTITIES_V2[0]
}
