// ============ 10 TÌNH HUỐNG MỞ ĐẦU (đợt 32) ============
// Tông realistic — mỗi mở đầu là 1 "seed" chỉ dẫn cho AI viết đoạn đầu.
// Người chơi chọn 1, hoặc "Để AI tự nghĩ", hoặc tự viết mở đầu riêng.
// Seed được ghép cùng thân phận + xuất thân + ngày bắt đầu trong directive.

export const OPENINGS = [
  {
    key: 'quiet-morning',
    name: 'Buổi sáng bình thường',
    seed: 'Mở đầu bằng một buổi sáng HOÀN TOÀN bình thường tại nơi nhân vật đang sống — sinh hoạt thường nhật đúng với thân phận, không biến cố. Sức hút nằm ở đời sống và không khí; hành trình sẽ tự lớn dần từ những điều nhỏ.',
  },
  {
    key: 'license-day',
    name: 'Ngày nhận giấy phép trainer',
    seed: 'Hôm nay nhân vật đi làm THỦ TỤC nhận giấy phép trainer tại cơ quan địa phương: xếp hàng, giấy tờ, lệ phí, ảnh thẻ — thế giới Pokémon vận hành như một xã hội thật. Xen kẽ những người cùng xếp hàng với lý do riêng của họ.',
  },
  {
    key: 'leaving-home',
    name: 'Rời nhà sau một mâu thuẫn',
    seed: 'Nhân vật rời nhà sau một mâu thuẫn gia đình CHƯA được giải quyết (liên quan tới thân phận — kỳ vọng, nghề nghiệp, hay lựa chọn sống). Không bi kịch hoá: người thân vẫn là người thân, chỉ là lúc này không ai chịu lùi. Cánh cửa sau lưng đóng lại không có nghĩa là khoá.',
  },
  {
    key: 'first-job',
    name: 'Ngày đầu của công việc đầu tiên',
    seed: 'Ngày đầu tiên nhân vật bắt đầu công việc gắn với thân phận của mình — việc thật, có người hướng dẫn, có quy tắc, có sai sót ngày đầu. Hành trình trainer sẽ mọc ra TỪ công việc này chứ không thay thế nó.',
  },
  {
    key: 'accident',
    name: 'Tai nạn nhỏ đảo lộn kế hoạch',
    seed: 'Một tai nạn NHỎ nhưng thật (hỏng phương tiện, lở đường, Pokémon hoang phá hoại, giấy tờ thất lạc) làm đảo lộn kế hoạch trong ngày của nhân vật — buộc phải xoay xở và vì thế cuộc đời rẽ sang một nhánh không định trước. Không ai chết, không ai truy sát — chỉ là đời không như lịch.',
  },
  {
    key: 'witness',
    name: 'Chứng kiến chuyện không nên thấy',
    seed: 'Nhân vật VÔ TÌNH thấy một mảnh của chuyện mờ ám (một cuộc trao tay ban đêm, một chiếc xe chở lồng phủ bạt, một cuộc nói chuyện nghe nhầm) — KHÔNG bị phát hiện, KHÔNG bị truy đuổi, và không hiểu hết mình vừa thấy gì. Chỉ là một cái dằm ghim vào trí nhớ; đào sâu hay quên đi là quyền của người chơi.',
  },
  {
    key: 'inheritance',
    name: 'Món đồ người thân để lại',
    seed: 'Nhân vật nhận được một món đồ/lá thư của một người thân (đã mất hoặc đi xa) để lại — món đồ bình thường nhưng kèm một lời nhắn hoặc chi tiết chưa giải thích được. Cảm xúc là chính, bí ẩn chỉ là hạt mầm để rất lâu sau mới nảy.',
  },
  {
    key: 'storm-shelter',
    name: 'Kẹt lại nơi trú bão',
    seed: 'Một trận bão/thiên tai vừa phải khiến nhân vật kẹt lại một nơi trú tạm (trung tâm Pokémon, nhà kho, trạm chờ) cùng vài người lạ và Pokémon của họ — mỗi người một câu chuyện, một lý do lên đường. Vài mối quan hệ đầu tiên của hành trình bắt đầu từ đêm này.',
  },
  {
    key: 'city-arrival',
    name: 'Ngày đầu tới thành phố lớn',
    seed: 'Nhân vật vừa đặt chân tới một thành phố lớn xa lạ (khác nơi xuất thân) với ít tiền và một lý do riêng gắn với thân phận. Thành phố qua mắt người mới tới: choáng ngợp, đắt đỏ, thờ ơ — và đầy cơ hội cho người biết nhìn.',
  },
  {
    key: 'debt',
    name: 'Món nợ buộc phải lên đường',
    seed: 'Nhân vật (hoặc gia đình) đang gánh một món nợ — tiền bạc hoặc ân tình — và hành trình này bắt đầu vì nó: một khoản phải trả, một lời hứa phải giữ. Chủ nợ/người được hứa là người THẬT có logic riêng, không phải hung thần một chiều.',
  },
]

export function getOpening(key) {
  return OPENINGS.find((o) => o.key === key) ?? null
}
