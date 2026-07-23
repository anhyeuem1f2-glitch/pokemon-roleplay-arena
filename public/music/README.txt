=====================================================================
 NHẠC NỀN TRAINER ARENA — HƯỚNG DẪN BỎ FILE (đợt 28)
=====================================================================

Bỏ file nhạc .mp3 (hoặc .ogg) vào ĐÚNG thư mục này (public/music/)
với đúng TÊN FILE bên dưới. App tự dò: file nào không có thì tự lùi
về track chung hơn (VD thiếu area-cave.mp3 → dùng region-kanto.mp3 →
thiếu nốt → exploration.mp3 → vẫn thiếu → im lặng). KHÔNG bao giờ lỗi
vì thiếu file. Đổi/thêm file xong nhớ TẢI LẠI TRANG (F5).

Chỉ cần tối thiểu 3 file là cả game có nhạc:
  exploration.mp3   — nhạc khám phá chung
  battle.mp3        — nhạc trận chung
  title.mp3         — màn hình mở đầu

---------------------------------------------------------------------
1) MÀN HÌNH & KHÁM PHÁ
---------------------------------------------------------------------
  title.mp3            Màn hình mở đầu / Dev / Cài đặt (fallback: exploration)
  exploration.mp3      Nhạc khám phá chung — fallback CUỐI của mọi khu vực

  Theme riêng từng vùng (phát khi đứng trong vùng đó):
  region-kanto.mp3     region-johto.mp3     region-hoenn.mp3
  region-sinnoh.mp3    region-unova.mp3     region-kalos.mp3
  region-alola.mp3     region-galar.mp3     region-paldea.mp3

  Đè theo "CHẤT" của khu (ưu tiên cao hơn theme vùng — khu nào khớp
  loại nào thì phát loại đó, dò theo tên khu trong bản đồ 9 vùng):
  area-town.mp3          Thị trấn khởi đầu / làng yên bình (Pallet, Littleroot...)
  area-city.mp3          Đô thị lớn (Castelia, Lumiose, Goldenrod...)
  area-forest.mp3        Rừng (Viridian Forest, Ilex, Eterna...)
  area-cave.mp3          Hang động / hầm mỏ / lòng núi (Mt. Moon, Rock Tunnel...)
  area-sea.mp3           Biển / đảo / hải trình (Whirl Islands, Seafolk...)
  area-volcano.mp3       Núi lửa (Mt. Chimney, Cinnabar, Wela...)
  area-ice.mp3           Băng tuyết (Ice Path, Snowpoint, Glaseado...)
  area-tower.mp3         Tháp / nơi u linh (Lavender, Mt. Pyre, Burned Tower...)
  area-victory-road.mp3  Victory Road / Liên đoàn / Nhà vô địch
  area-endgame.mp3       Nơi huyền thoại trú ngụ (Cerulean Cave, Spear Pillar,
                         Area Zero, Ultra Space, Sky Pillar...)

---------------------------------------------------------------------
2) TRẬN ĐẤU (cả trận theo lượt lẫn combat anime)
---------------------------------------------------------------------
  battle.mp3               Nhạc trận CHUNG — fallback cuối của mọi trận
  battle-wild.mp3          Gặp Pokémon hoang dã thường
  battle-boss.mp3          Boss huyền thoại bậc thấp/huyền ảo (fallback về wild)
  battle-legendary.mp3     Huyền thoại (bậc thấp + huyền ảo dùng chung nếu
                           không có battle-boss riêng)
  battle-legendary-high.mp3  Huyền thoại BẬC CAO — đại diện bản game
                           (Mewtwo, Ho-Oh, Arceus, Eternatus...)

  Jingle kết quả (phát 1 LẦN, không lặp, xong tự quay lại nhạc khu vực):
  victory.mp3          Thắng / bắt được / dụ dỗ thành công / hoà giải
  defeat.mp3           Thua trận
  (Chạy thoát / đối phương bỏ chạy: không jingle, về thẳng nhạc khu vực.)

---------------------------------------------------------------------
3) KHÁC
---------------------------------------------------------------------
  shop.mp3             Trong cửa hàng (mở giỏ hàng 🛒)

---------------------------------------------------------------------
GHI CHÚ
---------------------------------------------------------------------
- Đuôi file: ưu tiên .mp3; không có thì app tự thử .ogg cùng tên.
- Nhạc nền tự LẶP; jingle victory/defeat phát đúng 1 lần.
- Trình duyệt chặn autoplay: nhạc chỉ bắt đầu sau cú click/phím đầu
  tiên trên trang — widget 🎵 (cột phải) sẽ nhắc "bấm vào trang để phát".
- Bật/tắt + âm lượng: widget 🎵 ở cột HUD phải, hoặc mục "Nhạc nền"
  trong Cài đặt. Thiết lập được lưu lại (localStorage).
- BẢN QUYỀN: nhạc Pokémon gốc thuộc Nintendo/Game Freak — file bạn bỏ
  vào đây là bạn tự chịu trách nhiệm; khi public cho cộng đồng nên cân
  nhắc dùng bản fan-made/royalty-free hoặc nhạc "lấy cảm hứng".
