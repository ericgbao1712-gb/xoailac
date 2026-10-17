# Xoài Lắc Ơi! — nâng cấp v2: đợt 1 (16/10/2026), v2.1 → v2.5 (17/10/2026)

Repo nội bộ: `web/xoailac/`. Các commit: fc847cd (phần lõi), d14db27 (giao diện), 5f01cc0 (sửa charset và ASSET_VER), ee7e010 (v2.1), 60dd040 (v2.2), 813726b (v2.3), 41cb6d2 (v2.4), 19329ff (v2.5), 41ffb38 (v2.5.1), 9499e32 (v2.5.2), 9d3ed4e (kiểm thử mã sao lưu), 1180fe4 (v2.6), v2.6.1 (XP dễ hơn), v2.6.2 (thanh EXP), v2.6.3 (giao hàng nhanh).
Đã có link chơi thử: artifact "Xoài Lắc Ơi! Bản Thử" (bản thứ 12, nhãn v2.6.3, có nút "Thử nhanh: quán Lv 32").

## v2.6.3 (17/10): quản kho về liền, giao hàng tối đa 10 phút
- **Quản kho:** khi hàng sắp hết thì mua về ngay (`QUANKHO.minutes` = 0), không còn chờ 25 phút.
- **Đặt hàng trước hoặc trong lúc bán:** giao trong tối đa `DELIVERY_MAX` = 10 phút. Mỗi nhà cung cấp có `openDelay` riêng:

  | Nhà cung cấp | Giao |
  |---|---|
  | App | 5 phút |
  | HTX | 8 phút |
  | Nhà vườn | 10 phút |
  | Vựa sỉ | 10 phút |

  Đặt buổi sáng thì hàng tới bấy nhiêu phút sau khi mở hàng. Đặt sau khi đóng cửa vẫn giao sáng mai.
- **Đánh đổi:** vựa sỉ mất cái giá phải trả là "chờ tới mai", giờ chỉ còn trái hơi dập và đơn tối thiểu 200k.
- **Kiểm thử:** `test_core.mjs` 206 kiểm tra đều đạt.

## v2.6.2 (17/10): thanh EXP
- HUD có thêm hàng EXP giữa hàng tiền và hàng nhiệm vụ: thanh vàng, số "EXP hiện có / EXP cần", % và cấp kế tiếp. Thanh nháy viền mỗi khi nhận EXP; bấm vào thì mở Hành trình lên cấp.
- Đã chụp kiểm tra ở màn rộng 390px, 360px và trên máy tính.

## v2.6.1 (17/10): lên cấp dễ hơn
- **Đường XP:** mỗi cấp cần ít hơn 20% XP so với trước (`XP_EASE` = 0.8 trong config.js).
- **Save cũ:** nếu XP đã tích đủ theo mức mới thì được lên cấp ngay khi tải (`settleXp`), kèm mọi mở khóa của cấp đó và lời Má báo. Không ai bị mất cấp.
- **Mô phỏng 20 ngày:** kết thúc ở Lv 16 thay vì Lv 15.
- **Kiểm thử:** `test_core.mjs` 202 kiểm tra đều đạt.

## v2.6 (17/10): thanh lý hàng cũ
Commit 1180fe4. Chưa đẩy lên GitHub vì người dùng dặn "khoan up". Repo dự định: ericgbao1712-gb/xoailac.
- **Nơi thanh lý:** tab **Kho ▸ Thanh lý**. Người mua là "Cô Ba đầu hẻm" (`C.LIQUIDATE`).
- **Thời điểm:** chỉ bán được lúc chuẩn bị (buổi sáng, trước khi mở hàng).
- **Cách bán:** lô cũ nhất bán trước (`liquidate`, `liquidateQuote`, `oldStock` trong economy.js).
- **Giá thu theo vốn của từng lô:**

  | Hạn còn lại | Thu lại |
  |---|---|
  | Hết hạn sau hôm nay | 35% vốn |
  | Còn 1 ngày | 50% vốn |
  | Còn lâu hơn | 60% vốn |

  Mức thu luôn thấp hơn giá rẻ nhất của nhà cung cấp (vựa sỉ 80%), nên không có lời khi mua rẻ rồi bán lại.
- **Sổ sách:** tiền thu cộng vào két. Phần lỗ (vốn trừ tiền thu) ghi vào `costs.liquidation`, hiện thành dòng "Lỗ thanh lý hàng cũ" trong báo cáo cuối ngày.
- **Nút bán:** Bán 1, Bán 5, Bán phần sắp hạn, Bán hết từng món. Có thêm nút thanh lý một lần mọi hàng hết hạn sau hôm nay (hỏi lại trước khi bán).
- **Kiểm thử:** `test_core.mjs` 199 kiểm tra đều đạt.

## Mã sao lưu bản cũ (17/10)
Commit 9d3ed4e.
- Định dạng mã `XOAILAC1.…` không đổi từ bản gốc.
- Đã thử thật trong trình duyệt: mã do 7 bản tạo ra (bản gốc v1, v2, v2.1, v2.2, v2.3, v2.4, v2.5) đều khôi phục được, ở màn mở đầu lẫn trong Cài đặt, và chơi tiếp được.
- Tên quán, cấp, ngày và tiền được giữ nguyên; tiền chỉ có thể tăng (do hoàn tiền đồ đã bị gỡ).
- Các mã này nằm trong `tools/xoailac/fixtures/backup-codes.json`, được kiểm tra ở mục 16 của `test_core` (187 kiểm tra). Mỗi bản mới nên thêm mã do bản đó tạo vào file này.
- Đã gửi người dùng gói source `xoai-lac-ban-thu-v2.5.2.zip`, xem README trong gói.

## v2.5.2 (17/10)
Commit 9499e32.
- **Ô quầy:** từ quầy cấp 4 có tối đa 5 ô gọi món (`maxTables` 5). Khi đủ 5 ô thì khoảng cách giữa các ô là 40px, nằm gọn trong khung 200px.
- **Bàn dài sát lan can:** cấp 3 của nâng cấp "Bàn ghế hai bên quán" (6.000k, cần quầy cấp 3).
  - Vị trí: góc sau bên trái (`BAR` trong layouts.js), 4 ghế, khách ngồi quay lưng về phía người chơi. Hàng chờ vẫn ở bên phải.
  - Đây là bàn thứ 5, chỉ có khách ngồi khi 4 bàn kia đã kín.
  - Lề đường chỉ đủ chỗ cho một hàng bàn (mỗi bàn cao khoảng 28px, từ lan can xuống quầy còn 44px), nên không thêm được hàng bàn thứ hai.
  - Cây kiểng chuyển ra hai góc sau, sát lan can.
- **Quản kho tự đi chợ khi đang bán** (`quankhoRun`, thông số ở `C.QUANKHO`):
  - Cứ 5 phút trong game kiểm tra một lần. Món trên thực đơn hoặc món ăn kèm còn từ 2 phần trở xuống, hoặc ly/hộp còn từ 8 cái trở xuống, thì quản kho đi chợ.
  - Mua giá chợ, không mất phí giao, khoảng 25 phút sau mang về; mỗi lần chỉ đi một chuyến.
  - Luôn để lại ít nhất 50k trong két; không đi khi đã gần đóng cửa.
  - Chuyến đi hiện trong Kho ▸ Hàng đang giao.
  - Buổi sáng quản kho nhập cả món ăn kèm (mỗi món tối thiểu 4 phần).
- **Save đời đầu có 6 bộ bàn:** giữ 4 bàn + bàn dài, hoàn 6.000k (trước đây là giữ 4 bàn, hoàn 8.500k).
- **Kiểm thử:** `test_core.mjs` 150 kiểm tra đều đạt.

## v2.5.1 (17/10)
Commit 41ffb38. Bỏ rổ trái cây và hũ muối hai đầu quầy cùng miếng gỗ vẽ dính bên dưới; giờ mặt quầy hiện trọn chất liệu.
- Đã thử tách riêng miếng gỗ và giữ lại đồ, nhưng không được: ảnh vẽ kiểu painterly, rổ và miếng gỗ cùng màu, viền không khép kín, nên tách tự động sẽ rỗ hoặc mất đáy rổ.
- Ảnh gốc vẫn còn trong `counter.png` (khung `left`/`right`) nếu sau này cần vẽ lại.

## v2.5 (17/10): món ăn kèm, tab Giá bán, quầy đổi chất liệu, bảng hiệu treo dưới bạt
Commit 19329ff.
- **Món ăn kèm:** khai báo trong `INGREDIENTS` với `side` (giá thu thêm), `quest` (id nhiệm vụ chính), `kinds` (kiểu khách thích món nào). Món được nhập kho, có hạn dùng và tự nhập lại như topping, nhưng không nằm trong lưới topping.

  | Món | Mở khóa | Thu thêm | Vốn | Giữ được |
  |---|---|---|---|---|
  | Bánh tráng trộn | Lv 4 | 20k | 8k | 2 ngày |
  | Cá viên chiên | Lv 6 | 15k | 6k | 2 ngày |
  | Phô mai que | Lv 9 | 18k | 7k | 1 ngày |
  | Bò bía | Lv 12 | 15k | 6k | 1 ngày |
  | Xoài sấy dẻo | Lv 14 | 25k | 10k | 5 ngày |
  | Bánh tráng nướng | nhiệm vụ q12 | 22k | 8k | 1 ngày |
  | Trứng cút xào me | nhiệm vụ q19 | 28k | 11k | 1 ngày |
  | Khô gà lá chanh | nhiệm vụ q25 | 35k | 14k | 5 ngày |

  - **Khách gọi:** 32% nhóm gọi một món nếu kho còn; nhóm từ 3 người có 25% gọi thêm món thứ hai. Hàng đã được phiếu giữ (`reservedStock`) nên không ai gọi được hàng đã hết.
  - **Soạn phiếu:** nút **Ăn kèm** ở quầy (`addSides`). Thợ lắc tự cho món vào (`putSides`). Nếu thiếu hàng thì phần ăn kèm bị bỏ, không làm kẹt phiếu.
  - **Tiền và thống kê:** tiền món kèm cộng vào hóa đơn; có `sidesSold` hằng ngày và tổng.
  - **Nhiệm vụ mới:** nhiệm vụ ngày `d_sides`; Sổ tay thêm v19 và v20.
  - **Giá chợ:** món ăn kèm có giá cố định, không tốn thêm số ngẫu nhiên. Nhà vườn không bán món ăn kèm.
  - **Hình:** 8 icon mới vẽ bằng code (`tools/art/draw_sides.py`, đóng gói bằng `pack_icons.py`); `ASSET_VER` lên xl5.
- **Tab Giá bán:** Nâng cấp ▸ Giá bán (`ui/sheets/prices.js`), mỗi món một thẻ gọn. Thẻ món ở Thực đơn chỉ còn nút "Chỉnh giá bán ›".
- **Chất liệu quầy:** theo cấp nâng cấp `stovetype` (Quầy sơ chế), cấp 0→4 là gỗ mộc → gỗ sồi → sơn bạc hà (viền vàng) → inox → đá cẩm thạch (viền vàng, mặt trước xanh navy).
  - Mỗi chất liệu được tạo lúc chạy từ ô gỗ gốc (`render/counterMat.js`).
  - Ô trống trên quầy giờ là miếng lót cùng tông với chất liệu.
- **Bảng hiệu:** treo bằng 2 dây từ tấm bạt sọc trên cùng, nằm giữa màn hình (tem + bảng được căn giữa cùng nhau). Thông báo dời xuống dưới bảng; bóng bay chuyển sang hai bên bảng.
- **Kiểm thử:**
  - `test_core.mjs` 139 kiểm tra đều đạt.
  - Mô phỏng 4 seed × 20 ngày: lãi ngày 8–20 trung bình khoảng như trước (≈118k so với 121k). Kết quả dao động lớn theo seed; có seed tụt vì hàng ăn kèm hạn 1–2 ngày bị bỏ phí.

## v2.4 (17/10): bỏ đồ không hiển thị, mặt tiền mở theo cấp, tem rõ chữ
Commit 41cb6d2.
- **Gỡ đồ trang trí không hiện ra ngoài quán:**
  - Gồm đèn dây vàng (dây đèn vốn luôn có sẵn), toàn bộ nhóm Tường và Đặc biệt.
  - Save cũ được hoàn đúng giá đã mua, chỉ một lần (`C.REMOVED_DECO`), có lời Má báo. Ô đang treo đồ bị gỡ quay về mặc định.
  - Theo đó, các hiệu ứng tip/khách/kiên nhẫn của đồ Đặc biệt cũng mất.
  - Quà điểm danh ngày 7: trước là mèo thần tài + 3 triệu, giờ là 5,5 triệu.
- **Mặt tiền mở dần theo cấp:** `FACADE.items` có 4 nhóm (bảng hiệu, cờ dây, chậu hoa, bóng bay), mỗi món có `lv` và `amb` (điểm độ sang cộng vào `ambienceOf`). Đổi miễn phí sau khi mở.

  | Cấp | Món |
  |---|---|
  | 9 | Cờ đỏ vàng |
  | 13 | Chậu cúc |
  | 16 | Bảng vàng viền đỏ |
  | 18 | Cờ xanh xoài |
  | 20 | Hoa giấy |
  | 22 | Bảng gỗ nâu |
  | 24 | Bóng bay tim |
  | 26 | Bảng hồng pastel |
  | 28 | Sen đá |
  | 31 | Bảng neon |
  | 33 | Cờ cầu vồng |
  | 35 | Bóng 7 màu |
  | 36 | Xương rồng |
  | 38 | Dây đèn lồng mini (sáng ban đêm) |
  | 40 | Lan tím |

- **6 perk bị thay bằng trang trí:**

  | Cấp | Perk cũ |
  |---|---|
  | 13 | Thẻ khách quen |
  | 20 | Bảng giá điện tử |
  | 26 | Quạt phun sương |
  | 33 | Combo nước cấp 2 |
  | 36 | Tip ví điện tử |
  | 38 | Mùa lễ hội |

  - Các cấp 9, 16, 18, 22, 24, 28, 35, 40 có thêm trang trí, cạnh thứ đã mở sẵn.
- **Nhiệm vụ trang trí** (q11, q24) giờ đếm cả các món mặt tiền. Chữ nhiệm vụ đã sửa cho khớp; chỉ số (index) nhiệm vụ giữ nguyên.
- **Tem logo:**
  - Khẩu hiệu to và đậm hơn, không bao giờ lớn hơn tên quán, và luôn nằm trong vòng nét đứt.
  - Khung ruy băng: khẩu hiệu nằm trên cung phía trên, không còn đè lên viền dưới.
  - Tem nhỏ hơn 90px chỉ còn khung, linh vật và dải băng (bỏ chữ không đọc được).
- **Kiểm thử:**
  - `test_core.mjs` 125 kiểm tra đều đạt.
  - Mô phỏng 20 ngày: lãi ngày 8–20 giảm khoảng 3% (bỏ Thẻ khách quen Lv 13); khách bỏ về ít hơn.

## v2.3 (17/10): tem logo, đồng phục, mặt tiền
Commit 813726b. Các tùy chọn đều miễn phí và đổi được bất cứ lúc nào sau khi mở khóa. Tiền thưởng (bonus) vẫn nằm ở perk của cấp đó.
- **Lv 24: tem logo** (Quán → Trang trí → Thiết kế)
  - Tùy chọn: khung tròn / bo góc / ruy băng; chữ thẳng / cong trên / cong dưới; 8 màu nền; 9 linh vật lấy từ icon có sẵn; khẩu hiệu tối đa 22 ký tự; có công tắc tắt tem.
  - Tem hiện trên ly khách cầm, ly đưa qua quầy, nút LẮC và gắn bên trái bảng hiệu.
  - Tem được vẽ ở độ phân giải màn hình, đè lên lớp pixel. Ban đêm tem chỉ mờ đi, không bị phủ ánh sáng như các phần khác.
- **Lv 21: đồng phục** (Nhân viên → Đội)
  - 8 màu × 3 kiểu (tạp dề / áo thun đồng màu / áo tối, tạp dề màu).
  - Cách làm: đổi màu sprite lúc chạy. Vải đỏ/cam bên dưới đầu (tạp dề, áo gile, khăn, nơ) và nón xanh của quản kho đổi sang màu đã chọn; áo trắng đổi theo kiểu. Da, tóc, mặt giữ nguyên.
  - **Mới:** tối đa 2 nhân viên đã thuê hiện ngoài quán (ưu tiên phục vụ). Họ đứng giữa các bàn và ra lau bàn khi khách rời đi. Phần này chỉ để nhìn, không đổi logic game.
- **Lv 31: mặt tiền** (Quán → Trang trí)
  - Bảng hiệu: gỗ xanh / vàng viền đỏ / neon hồng có ánh sáng / gỗ nâu.
  - Cờ dây: đỏ vàng / cầu vồng / xanh xoài.
  - Chậu hoa trên quầy: cúc / hoa giấy / sen đá.
- **Sửa lỗi:**
  - Đèn lồng và cây kiểng đã mua trước đây không hiện ở màn quầy, giờ đã hiện.
  - Bong bóng gọi thêm trái cây hiện ô hồng do sai tên icon, đã sửa.
- **Save:**
  - Thêm `brand`, `uniform`, `facade`. Mỗi khi tải save đều qua bộ lọc (sanitize).
  - Save cũ nhận mặc định, nên quán trông y như trước.
  - Các tùy chọn chỉ có tác dụng khi đã đạt cấp mở khóa.
- **Kiểm thử:**
  - `test_core.mjs` 110 kiểm tra đều đạt. Mô phỏng 20 ngày không đổi.
  - Đã chụp trình duyệt: cảnh ngày/đêm, cửa sổ thiết kế, thẻ đồng phục, quán Lv 7 không bị ảnh hưởng. Không có lỗi JS.

## v2.2 (17/10): mỗi cấp một tính năng
Commit 60dd040. Artifact cập nhật lên bản thứ 3 (nhãn v2.2).
- **Mọi cấp từ Lv 2 đến Lv 40 đều mở một thứ mới** (có kiểm thử tự động). Lv 16/18/22 giữ nguyên thứ đã mở sẵn (cấp quán, món mới).
- **Cơ chế:** mảng `C.PERKS` + `perkFx(G)` gộp hiệu ứng, cache theo cấp. Hiện trên Hành trình lên cấp và thẻ lên cấp.

  | Cấp | Tính năng | Hiệu ứng |
  |---|---|---|
  | 13 | Thẻ khách quen | sinh viên ghé +15% |
  | 14 | Muối tôm Tây Ninh | chất lượng +0,05 |
  | 15 | Ngày hội học trò | khuyến mãi: sinh viên ×2 |
  | 17 | Kho lạnh siêu lớn | nâng kho cấp 6 (90.000k) |
  | 19 | Xe đẩy thứ hai | hàng chờ +2 |
  | 20 | Bảng giá điện tử | bớt chê đắt |
  | 21 | Đồng phục | tâm trạng nhân viên +8 |
  | 23 | Công thức cấp 6 | |
  | 24 | Ly in logo | điểm +0,1, ly/hộp ×1,25 giá |
  | 25 | Chi nhánh cấp 6 | |
  | 26 | Quạt phun sương | kiên nhẫn ×1,1 |
  | 27 | Quản lý ca | nhân viên nhanh ×1,1 |
  | 28 | Tủ trưng bày | kệ +1 |
  | 29 | Mối ruột | giá nhập ×0,95 |
  | 30 | HTX Tiền Giang | nhà cung cấp: −10%, giao 60 phút |
  | 31 | Vua xoài lắc Sài Gòn | độ sang +10% |
  | 32 | Quầy sơ chế phụ | sơ chế ×1,15 |
  | 33 | Combo nước cấp 2 | gọi nước +15% |
  | 34 | Chi nhánh Phú Quốc | chi nhánh thứ 6, không tính vào kết thúc |
  | 35 | Tour ăn vặt | đoàn du lịch ×2, khách Tây ×1,3 |
  | 36 | Tip ví điện tử | tip ×1,1 |
  | 37 | Giờ vàng 13h | |
  | 38 | Mùa lễ hội | sự kiện ×2 |
  | 39 | Thợ lắc bậc thầy | XP nhân viên ×1,5 |
  | 40 | Huyền thoại | chất lượng +0,05, tip ×1,05 |

- **Từ Lv 41:** mỗi cấp 1 rương vàng (`masteryChests`, mở ở sổ nhiệm vụ). Cấp chia hết cho 5 tặng thêm vé tuyển.
- **XP sau Lv 22:** tăng tuyến tính 8%/cấp so với mức Lv 22, thay vì nhân 1,295 mỗi cấp.
- **10 nhiệm vụ chính mới** (q38–q47), nối vào cuối danh sách: Lv 25/30/35/40, 3 công thức cấp 6, 10.000 phần, 4,8★ với 100 đánh giá, 6 chi nhánh, lãi 50.000k/ngày, gặp 11 loại khách.
- **Kiểm thử:** `test_core.mjs` 98 kiểm tra đều đạt. Mô phỏng 20 ngày vẫn như v2.1. Đã kiểm tra trong trình duyệt màn hành trình và thẻ lên cấp Lv 31, không có lỗi JS.
- **Lưu ý:** chưa ai chơi thật tới Lv 30+, nên độ dài cày và độ mạnh các perk mới chỉ là ước lượng.

## v2.1 (17/10)
- **Bàn ghế hai bên quán:**
  - Xếp một hàng 4 bộ tại y=95, các bàn cách nhau ≥46px, chừa lối đi giữa x 92–108.
  - Hàng chờ đứng phía sau.
  - Đạo cụ trên quầy hạ thấp 16px để không che bàn.
  - Nâng cấp `sidetable` còn 2 cấp: 400k, 1,5tr; từ Lv 3, cấp 2 cần quán cấp 2.
  - Save của bản v2 cũ có nhiều hơn 4 bộ sẽ bị cắt về 4 và **được hoàn tiền** các bộ dư (2.500k + 6.000k), có lời Má báo.
- **Sổ tay quán mới (`V2_QUESTS`):**
  - 18 việc, chạy song song với 37 mục tiêu chính. Chỉ số (index) của mục tiêu chính giữ nguyên nên save cũ không lệch tiến độ.
  - Một số việc khóa theo cấp (`minLv`).
- **7 nhiệm vụ ngày mới:** khách ngồi bàn, tiền tip, lãi trong ngày, bán xoài lắc, bán cóc lắc, không thiếu vật tư, không ai chê đắt.
- **Tính năng mở theo cấp** (có hiện trên thẻ lên cấp):

  | Cấp | Mở khóa |
  |---|---|
  | Lv 2 | Tự đặt giá |
  | Lv 3 | Kê thêm bàn, Vựa sỉ |
  | Lv 4 | Thưởng nóng nhân viên |
  | Lv 5 | Nhà vườn |
  | Lv 6 | 4 nhiệm vụ mỗi ngày |
  | Lv 8 | Giờ vàng: chỉ 14h–17h, khách ×1,8, giá ×0,8 |
  | Lv 12 | Combo kèm nước: tỉ lệ gọi nước +20%, giá nước ×0,8 cả ngày, phí 50k × hệ số cấp quán |

- **Kiểm thử:** `test_core.mjs` 82 kiểm tra đều đạt. Mô phỏng 20 ngày: lên cấp quán 2 vào ngày 6, cấp 3 vào ngày 12.

## Đợt 1 — đã làm, có logic chạy thật
- **Màn bán hàng:**
  - Dock gọn: trái cây và topping gom vào một lưới phím 44px, topping chưa mở thì ẩn. Dock cao khoảng 245px (trước khoảng 385px).
  - HUD và thanh điều hướng nhỏ lại.
  - Thông báo chia 4 mức (info, good, bad, big), tối đa 2 cái cùng lúc, nằm ở phía trên chỗ bầu trời.
- **Tự đặt giá bán:**
  - Khoảng giá cho phép: 0,5–2,0 × giá gốc.
  - Giá ảnh hưởng 4 thứ: món khách chọn, tỉ lệ chê đắt rồi bỏ đi, lượng khách ghé (truyền miệng), và điểm "đáng tiền".
  - Giá chốt theo thời điểm khách gọi món, được lưu và không tự đổi.
- **Vật tư** (7 loại):
  - Ly lắc và hộp giấy là bắt buộc.
  - Ly nhựa đựng nước dùng cho nước uống.
  - Xiên, đũa, túi, khăn là tùy chọn; thiếu mỗi món trừ 0,15 điểm.
- **4 nhà cung cấp:**

  | Nhà cung cấp | Giá | Giao hàng | Ghi chú |
  |---|---|---|---|
  | Chợ | giá chợ | lấy liền | chỉ trước giờ mở |
  | App | +12% | 40 phút | phí ship 15k |
  | Vựa sỉ | −20% | sáng hôm sau | chất lượng −0,06 |
  | Nhà vườn | +30% | 2 tiếng | chất lượng +0,12, HSD +1 ngày |

  - Mỗi lô hàng nhớ giá nhập và chất lượng.
- **Nợ lương và tâm trạng nhân viên:**
  - Nhân viên báo trước rồi mới nghỉ sau 2 lần đóng cửa.
  - Nợ của người đã nghỉ chuyển vào `wageDebt`.
  - Còn nợ thì không thuê được người mới.
  - Cách giữ người: trả nợ, nói chuyện, thưởng.
- **Cân bằng:** giá gợi ý giảm 5–9%; nâng cấp đầu game rẻ hơn 20–40%.
- **Save:**
  - Lên VERSION 2, vẫn dùng key cũ. Không xoá dữ liệu nào.
  - Trước khi nâng cấp lần đầu, bản gốc v1 được chép sang key `xoai-lac/save/v1.truoc-nang-cap-v2`.
- **Hình vẽ:** 8 icon mới vẽ bằng code (`tools/art/draw_supplies.py`, `pack_icons.py`).

## Chưa làm
- Thị trấn, mặt bằng, nhiều cửa hàng.
- Kết bạn, bảng xếp hạng, thách đấu: cần backend thật. Đang chờ quyền vào VPS.
