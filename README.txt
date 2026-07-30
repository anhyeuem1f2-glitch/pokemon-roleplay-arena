THƯ MỤC NHẠC NỀN — Trainer Arena
=================================

Chỉ cần bỏ file nhạc của bạn vào thư mục public/music/ với ĐÚNG tên file bên
 dưới (không phân biệt hoa thường, nhưng nên giữ đúng cho gọn). App sẽ tự dò
 lần lượt .mp3 rồi .ogg; thiếu file thì tự fallback, KHÔNG gây lỗi.

LUỒNG NHẠC MÀN HÌNH KHỞI ĐẦU
----------------------------
1) intro.mp3
   - Phát 1 lần ở đoạn tri ân màn mở đầu Pokémon Red/Blue.
   - Trong lúc bài này còn chạy, menu chính sẽ hiện ra dần.
2) title and adventure.mp3 → title.mp3 → exploration.mp3
   - Khi intro.mp3 phát xong, app tự chuyển sang danh sách nhạc title này.
   - Nếu thiếu bài đầu, app tự lùi xuống bài kế tiếp.

Danh sách file chuẩn
--------------------
intro.mp3

title and adventure.mp3
title.mp3
exploration.mp3

pokecenter.mp3
pokemon center.mp3
shop.mp3
rest.mp3
night.mp3
low hp.mp3
victory.mp3
defeat.mp3

battle.mp3
battle-wild.mp3
battle-trainer.mp3
battle-trainer-hard.mp3
battle-gym.mp3
battle-boss.mp3
battle-legendary.mp3
battle-legendary-high.mp3
battle-champion.mp3
battle-champion-cynthia.mp3

area-town.mp3
area-city.mp3
area-forest.mp3
area-sea.mp3
area-cave.mp3
area-ice.mp3
area-volcano.mp3
area-tower.mp3
area-victory-road.mp3
area-endgame.mp3

region-kanto.mp3
region-johto.mp3
region-hoenn.mp3
region-sinnoh.mp3
region-unova.mp3
region-kalos.mp3
region-alola.mp3
region-galar.mp3
region-paldea.mp3

Gợi ý nhanh
-----------
- Nếu chỉ muốn game có nhạc tối thiểu: bỏ ít nhất exploration.mp3, battle.mp3,
  title.mp3 (hoặc title and adventure.mp3), pokecenter.mp3.
- Nếu bạn đã đưa bài intro riêng lên GitHub, chỉ cần đảm bảo lúc build/deploy,
  file được copy thành public/music/intro.mp3 là app sẽ tự phát đúng thứ tự.
