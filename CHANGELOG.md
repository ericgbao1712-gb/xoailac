# Xoài Lắc Ơi! — nâng cấp v2: đợt 1 (16/10/2026), v2.1 → v2.5 (17/10/2026)

Repo nội bộ: `web/xoailac/`. Các commit: fc847cd (phần lõi), d14db27 (giao diện), 5f01cc0 (sửa charset và ASSET_VER), ee7e010 (v2.1), 60dd040 (v2.2), 813726b (v2.3), 41cb6d2 (v2.4), 19329ff (v2.5), 41ffb38 (v2.5.1), 9499e32 (v2.5.2), 9d3ed4e (kiểm thử mã sao lưu), 1180fe4 (v2.6), v2.6.1 (XP dễ hơn), v2.6.2 (thanh EXP), v2.6.3 (giao hàng nhanh), 70f966c (v2.6.4: bàn bar giữa, nhóm khách gọn), 4ac4bfd (v2.6.5: mưa và bạt), 2456cbc (v2.6.6: cài như ứng dụng), 7f7a723 (v2.6.7: EXP, phục vụ, dời quán chính), 9c0ebf5 (v2.6.8: nhiệm vụ bạt che mưa), 1165752 (v2.6.9: thiết bị mới), a3b4ae3 (v2.6.10: tốc độ ×3), ea12584 (v2.6.11: EXP nhiệm vụ), ea4f7f4 (v2.6.12: giảm một nửa).
Đã có link chơi thử: artifact "Xoài Lắc Ơi! Bản Thử" (bản thứ 25, nhãn v2.6.14, có nút "Thử nhanh: quán Lv 32").

## v2.6.14 (17/10): EXP nhiệm vụ giảm thêm một nửa, thông báo gọn ở góc, chọn ly / hộp lúc bán
Commit 968a634.
- **EXP nhiệm vụ** giảm thêm một nửa (`QUEST_XP`):

  | Phần thưởng | % thanh EXP |
  |---|---|
  | Mục tiêu chính | 3,75% |
  | Sổ tay quán mới | 2% |
  | Rương gỗ / bạc | 1% / 1,75% |
  | Rương vàng | 3% |

  Ví dụ ở Lv 30: mục tiêu chính khoảng 3.500 EXP. Mô phỏng 60 ngày: Lv 26 (v2.6.12: 27; trước khi tính theo %: 24).
- **Thông báo** (xong nhiệm vụ, đơn giao, mưa…):
  - Thành chip nhỏ, cỡ chữ khoảng 10,5px, một dòng.
  - Nằm sát góc phải, dưới lời nhắn của Má và băng "Giờ cao điểm". Nằm trên vùng trời/cảnh xa, không che khách xếp hàng hay khách ở quầy.
  - Câu thông báo xong nhiệm vụ được rút ngắn, ví dụ "Xong mục tiêu! Bấm để nhận".
- **Chọn ly / hộp lúc bán:**
  - Trên khay soạn phần có 2 nút nhỏ "Ly" và "Hộp" ở góc phải. Món mặc định đựng theo loại của nó (lắc thì ly, xoài cát/thơm/thập cẩm thì hộp); bấm để đổi.
  - Mỗi nút có tem logo quán (khi đã thiết kế logo, Lv 24).
  - Loại nào hết thì nút mờ đi và không chọn được.
  - **Đổi luật:** trước đây hết loại đựng của món thì khách không gọi món đó được. Giờ hết hộp thì đựng bằng ly (và ngược lại), chỉ khi hết cả hai mới không bán được. Đơn giao hàng cũng vậy.
  - Lúc giao món, game trừ đúng loại đã chọn trong kho.
- **Kiểm thử:** `test_core.mjs` 251 kiểm tra đều đạt. Kiểm tra mới: hết hộp thì đơn dùng ly, không đổi được sang loại đã hết, đổi sang hộp thì kho trừ hộp. Đã chụp trên màn điện thoại 390px.

## v2.6.13 (17/10): hết dải xanh dưới thanh menu trên điện thoại
- **Lỗi:** trên điện thoại, dưới thanh menu (Kho, Thực đơn…) lộ ra một dải màu xanh lá. Đó là nền trang (dải màu trời xanh dùng làm viền khung trên máy tính) lộ ra khi khung game ngắn hơn màn hình thật. Chuyện này xảy ra khi thanh địa chỉ trình duyệt ẩn/hiện, hoặc khi game cài như ứng dụng chạy tràn viền.
- **Sửa** (commit 73daa74):
  - Khung game `#app` được ghim vào màn hình đang thấy (`position: fixed; inset: 0`), nên luôn cao đúng bằng màn hình và tự giãn khi thanh trình duyệt ẩn/hiện.
  - Trên màn hẹp (dưới 460px), nền trang đổi sang màu kem giống thanh menu. Nếu có khe hở thì cũng không còn thấy dải xanh.
  - Trên máy tính vẫn giữ khung viền gỗ giữa nền xanh như cũ.
- **Kiểm tra:**
  - Chụp ở 390×844 (điện thoại) và 1280×800 (máy tính): khung game cao đúng bằng màn hình, thanh menu nằm sát đáy.
  - Tăng chiều cao màn hình thêm 60px (giống lúc thanh địa chỉ ẩn đi): khung tự giãn theo.
  - `CSS_VER` lên xl5-v6.

## 17/10: bỏ dòng "Ý tưởng game" trong Cài đặt
- Thẻ giới thiệu ở cuối Cài đặt chỉ còn tên game và lời cảm ơn. Commit d2edb53.

## v2.6.12 (17/10): EXP nhiệm vụ giảm một nửa
- Người dùng thấy v2.6.11 lên cấp quá nhanh. Mọi tỉ lệ trong `QUEST_XP` giảm một nửa:

  | Phần thưởng | v2.6.11 | v2.6.12 |
  |---|---|---|
  | Mục tiêu chính | 15% thanh EXP | 7,5% |
  | Sổ tay quán mới | 8% | 4% |
  | Rương gỗ / bạc | 4% / 7% | 2% / 3,5% |
  | Rương vàng | 12% | 6% |

- Ví dụ ở Lv 30: mục tiêu chính khoảng 7.000 EXP, rương vàng khoảng 5.600. Mức cố định cũ vẫn là mức tối thiểu.
- **Mô phỏng 60 ngày:** Lv 27, nằm giữa trước v2.6.11 (Lv 24) và v2.6.11 (Lv 32). Mô phỏng 20 ngày: Lv 16.
- **Kiểm thử:** `test_core.mjs` 247 kiểm tra đều đạt.

## v2.6.11 (17/10): nhiệm vụ thưởng nhiều EXP hơn
- **Trước đây:** mục tiêu chính không cho EXP (chỉ cho tiền). Rương nhiệm vụ ngày cho cố định 20/40/80 EXP, Sổ tay cho 20–600 EXP. Từ Lv 20 trở đi, các con số này gần như không đáng kể so với thanh EXP (Lv 30 cần 93.494).
- **Giờ thưởng theo % thanh EXP của cấp đang chơi** (`QUEST_XP`). Mức cố định cũ là mức tối thiểu.

  | Phần thưởng | EXP |
  |---|---|
  | Mục tiêu chính | 15% thanh EXP |
  | Việc trong Sổ tay quán mới | 8% |
  | Rương gỗ / bạc (nhiệm vụ ngày) | 4% / 7% |
  | Rương vàng (xong hết nhiệm vụ ngày, rương thành thạo) | 12% |

  Ví dụ ở Lv 30: một mục tiêu chính cho khoảng 14.000 EXP. Làm hết nhiệm vụ ngày được khoảng 1/4 đến 1/3 cấp mỗi ngày.
- **Hiển thị:** tab Nhiệm vụ hiện đúng số EXP sẽ nhận (thẻ mục tiêu, Sổ tay, dòng rương nhiệm vụ ngày).
- **Mô phỏng:**
  - 20 ngày: Lv 17 thay vì Lv 15–16.
  - 60 ngày: Lv 32 thay vì Lv 24. Tăng tốc khá mạnh ở giai đoạn sau; muốn giảm thì chỉnh `QUEST_XP` trong `config.js`.
- **Kiểm thử:** `test_core.mjs` 246 kiểm tra đều đạt.

## v2.6.10 (17/10): tốc độ ×3
- Nút tốc độ trên HUD giờ xoay vòng 1× → 2× → 3× → 1×. Nút ×3 màu cam để phân biệt với ×2 màu vàng.
- ×3 mở ở Lv 10 (`FEATURES.speed3`), có trên thẻ lên cấp ("Tăng tốc ×3"). Chưa tới Lv 10 thì bấm từ 2× sẽ về 1× và báo "Tốc độ ×3 mở ở Lv 10".
- Save có tốc độ lạ sẽ về ×1 khi tải.
- **Kiểm thử:** `test_core.mjs` 243 kiểm tra đều đạt. Đã bấm thử trong trình duyệt đủ vòng 1× → 2× → 3× → 1×.

## v2.6.9 (17/10): thiết bị mới cho các cấp trống
- **Vấn đề:** cả 13 thiết bị cũ đều mua hết được ở quán cấp 4 (khoảng Lv 16–22). Từ Lv 23 tới Lv 40, mỗi cấp chỉ mở perk hoặc đồ trang trí; từ Lv 41 thì chỉ có rương. Tiền gần như không còn chỗ tiêu ngoài chi nhánh.
- **11 thiết bị mới.** Thiết bị bị khóa cấp vẫn hiện trong tab Nâng cấp, kèm chip "Cần Lv …". Lên cấp thì thẻ lên cấp có mục "Thiết bị mới".

  | Lv | Thiết bị | Giá | Tác dụng |
  |---|---|---|---|
  | 13 / 18 / 24 | Hũ lắc inox (3 cấp) | 6 / 20 / 60 tr | Vùng LẮC chuẩn rộng thêm 0,025 mỗi bên mỗi cấp; chất lượng +0,02/cấp |
  | 17 / 22 | Đá viên: thùng đá → máy làm đá | 12 / 45 tr | Vốn nước uống −12%/cấp; khách gọi nước +2%/cấp |
  | 19 | Máy xay sinh tố | 30 tr | Mở món nước **Sinh tố xoài** (bán 30k, vốn 12k); gọi nước +4% |
  | 20 / 26 | Bồn rửa tay & khay inox (2 cấp) | 15 / 40 tr | Chất lượng +0,03/cấp |
  | 25 | Máy ép miệng ly | 50 tr | Khách +4%, chất lượng +0,02 |
  | 27 | Máy tính bảng gọi món | 90 tr | Kiên nhẫn +12% |
  | 31 | Cân điện tử | 70 tr | Giá nhập trái cây, topping −4% |
  | 33 | Màn hình menu điện tử | 120 tr | Ít khách chê đắt hơn (cộng 0,15 vào "đáng tiền") |
  | 35 / 38 / 40 | Xe máy giao hàng (1–3 xe) | 100 / 220 / 400 tr | Mỗi xe 1,5 đơn mỗi giờ khi đang bán |
  | 36 | Máy lọc nước | 150 tr | Vốn nước uống −15%; gọi nước +3% |
  | 41–50 | Bảo trì bậc thầy (10 cấp) | 300 tr → 6,2 tỷ | Mỗi cấp: khách, tip, kiên nhẫn đều +1,5% |

- **Xe máy giao hàng:**
  - Mỗi đơn lấy nguyên liệu, ly/hộp và túi trong kho, thu giá bán trừ 20% phí app. Đơn giao không chiếm ô quầy.
  - Hết hàng thì đơn bị lỡ. Báo cáo cuối ngày ghi "n đơn giao · lỡ m (hết hàng)".
- **Thêm cấp cho thiết bị cũ:**

  | Lv | Thiết bị | Giá | Tác dụng |
  |---|---|---|---|
  | 21 / 30 | Dao thớt cấp 6–7: Máy bào sợi xoài, máy bào sợi đôi | 60 / 150 tr | Thợ lắc soạn phần nhanh hơn |
  | 23 | Máy tính tiền cấp 2: mã QR | 25 tr | Tip ×1,32 thay vì ×1,2; kiên nhẫn +5% |
  | 26 | Biển hiệu cấp 5: Đèn LED nháy chữ | 80 tr | Khách +12% |
  | 37 | Quạt & dù cấp 4: Quạt hơi nước + rèm tre | 180 tr | Độ sang +3 |

- **Icon:** 12 icon pixel mới (11 thiết bị và ly sinh tố), vẽ bằng `tools/art/draw_equip.py`, đóng gói bằng `pack_icons.py`. `ASSET_VER` lên xl6. Các khung icon cũ không bị đụng tới (`pack_icons.py` tự kiểm tra).
- **Save cũ:** các thiết bị mới bắt đầu ở cấp 0, không mất gì.
- **Kiểm thử:**
  - `test_core.mjs` 239 kiểm tra đều đạt. Kiểm tra mới: khóa theo cấp, hiệu ứng thật của từng nhóm, sinh tố cần máy xay, đơn giao chạy suốt ngày, save cũ.
  - Mô phỏng 20 ngày không đổi (chưa tới Lv 13).
  - Mô phỏng 60 ngày có mua thiết bị mới:
    - Lãi ngày 8–20 tăng khoảng 6%.
    - Khách bỏ về giảm từ 1.710 xuống 1.332.
    - Tiền cuối kỳ ít hơn khoảng 290 tr (764 tr so với 1.054 tr), vì đã tiêu vào thiết bị. Đây đúng là mục đích: có chỗ tiêu tiền.
  - Bot mô phỏng chưa tới được Lv 35+, nên xe giao hàng và Bảo trì bậc thầy mới chỉ được kiểm bằng kiểm thử riêng, chưa có số cân bằng dài hạn.

## v2.6.8 (17/10): nhiệm vụ "Mua bạt che mưa" không còn kẹt
- **Lỗi:** từ quán thứ 2 trở đi (đã có tán cây/mái che), tab Nâng cấp hiện bạt là "Có tán che" và không cho mua. Nhưng nhiệm vụ chỉ đếm lần bấm mua, nên người chơi rời gánh cổng trường trước khi mua bạt sẽ kẹt ở nhiệm vụ này mãi (0/1). Các nhiệm vụ chính đi lần lượt, nên những nhiệm vụ sau cũng không tới được.
- **Sửa:** nhiệm vụ "Mua …" (`upgrade:*`) đếm cả nâng cấp đã có. Riêng bạt: ở quán có mái che thì tính là đã có. Save đang kẹt sẽ thấy nhiệm vụ xong ngay và nhận thưởng 80k.
- **Kiểm thử:** `test_core.mjs` 224 kiểm tra đều đạt. Ở gánh cổng trường chưa có bạt thì nhiệm vụ vẫn 0/1 như cũ.

## v2.6.7 (17/10): EXP từ Lv 22 giảm thêm 10%, hiện đủ phục vụ, dời quán chính tới thành phố có chi nhánh
- **EXP:** từ Lv 22 trở lên, mỗi cấp cần ít hơn 10% so với v2.6.1 (`XP_LATE` = 0.9). Ví dụ: Lv 32 → 33 cần khoảng 103.000 thay vì 114.017. Save đang dư EXP thì được lên cấp ngay khi vào game (`settleXp`).
- **Nhân viên phục vụ:**
  - Trước đây ngoài quán chỉ vẽ tối đa 2 nhân viên, nên thuê 3 phục vụ mà chỉ thấy 2. Giờ phục vụ nào cũng hiện: 2 chỗ cũ cạnh bàn, chỗ thứ 3 ở lối đi giữa, rồi tới 2 đầu và 2 chỗ trước quầy (tối đa 7).
  - Sửa luôn nhiệm vụ "Thuê nhân viên phục vụ đầu tiên" bị kẹt 0/1 dù đã có phục vụ (save cũ, khôi phục mã). Giờ nhiệm vụ đếm cả phục vụ đang có trong đội.
- **Dời quán chính** (Quán ▸ Chi nhánh):
  - Mở chi nhánh ở thành phố nào thì bấm "Dời quán chính tới đây" để đổi cảnh quầy sang thành phố đó. Bấm "Về TP.HCM" để quay lại.
  - Chỉ đổi khung cảnh; tiền, khách, cấp quán và thu nhập chi nhánh giữ nguyên. Lựa chọn được lưu; nếu save không còn chi nhánh đó thì tự về TP.HCM.
  - Cảnh từng thành phố:

    | Thành phố | Cảnh |
    |---|---|
    | Hà Nội | cảnh Hồ Gươm có sẵn |
    | Đà Nẵng | cảnh cầu Rồng có sẵn |
    | Đà Lạt | đồi thông, nhà thờ Con Gà, biệt thự, hồ Xuân Hương |
    | Vũng Tàu | biển, Núi Nhỏ với tượng Chúa, ngọn hải đăng, thuyền đánh cá |
    | Cần Thơ | sông Hậu, cầu Cần Thơ, dừa, ghe chợ nổi treo cây bẹo |
    | Phú Quốc | hoàng hôn trên biển, hàng dừa, đảo, thuyền buồm |

  - 4 cảnh mới vẽ bằng code (`tools/art/draw_city_backdrops.py`), ghép lan can xích và nền gạch của cảnh cũ. Nét vẽ đơn giản hơn 4 cảnh gốc (vẽ tay).
- **Kiểm thử:** `test_core.mjs` 221 kiểm tra đều đạt. Đã chụp trình duyệt cả 4 cảnh mới, thẻ Chi nhánh và 3 phục vụ ngoài quán.

## v2.6.6 (17/10): cài được như ứng dụng, có logo riêng
- **Vì sao Android báo "Không thể cài đặt ứng dụng này":** trang game không có web app manifest (`manifest.json`), không có service worker và không có icon ứng dụng. Chrome chỉ cho cài khi đủ ba thứ đó, nên nó chỉ đề nghị "Tạo lối tắt" với chữ M xám của tên miền. iOS cũng tự vẽ chữ X vì không có `apple-touch-icon`.
- **Đã thêm:**

  | Thành phần | Nội dung |
  |---|---|
  | `manifest.json` | Tên "Xoài Lắc Ơi!", tên ngắn "Xoài Lắc", mở toàn màn hình (standalone), màn dọc, màu chủ đạo xanh lá |
  | Icon ứng dụng (`assets/app/`) | 192 và 512px loại thường, bản maskable cho icon tròn/bo góc của Android, `apple-touch-icon` 180px cho iOS, favicon 32px |
  | `sw.js` | Service worker: luôn lấy file mới từ máy chủ, chỉ dùng bản đã lưu khi mất mạng (nên mở game được cả lúc offline). Không động tới save. |
  | `index.html` | Link manifest, apple-touch-icon và các thẻ meta cho iOS |

- **Logo:** ly xoài lắc pixel và trái xoài xanh lấy từ chính bộ icon của game, nền vàng cam, viền mái bạt xanh trắng như HUD. Vẽ lại được bằng `tools/art/make_app_icon.py`.
- **Kiểm tra bằng Chromium (DevTools `Page.getInstallabilityErrors`):** không còn lỗi cài đặt. Service worker hoạt động; đã tắt mạng rồi tải lại trang, game vẫn mở được.
- **Cần làm để thấy trên điện thoại:**
  - Chép thư mục `web/xoailac/` mới lên máy chủ meegame.shop.
  - iOS: xóa lối tắt cũ rồi "Thêm vào MH chính" lại thì mới nhận logo mới.
  - Không cài được từ link chơi thử trên claude.ai, vì trang đó chạy trong khung của claude.ai.

## v2.6.5 (17/10): mưa không rơi lên quầy, bạt tự kéo từ Chợ đêm bờ kè
- **Quầy khô ráo:** mưa chỉ rơi tới mép trên của quầy (`drawWeather` có thêm tham số `maxY` = `counter.top`), ở mọi cấp quán.
- **Bạt tự kéo:** từ Chợ đêm bờ kè (cấp quán 4, `RAIN.autoTarpTier`), hễ mưa là bạt tự kéo ra, kèm thông báo "Mưa rồi! Bạt tự kéo ra che cho khách.". Tạnh mưa thì bạt tự cuốn lại như trước. Người chơi không cần mua bạt hay chạm nút.
- Ở gánh cổng trường (cấp 1) vẫn phải tự chạm KÉO BẠT như cũ.
- **Hình bạt mới:**
  - Bạt chỉ hiện dần về phía mép trước, nên bầu trời và bảng hiệu không còn bị phủ sọc.
  - Dưới bạt khô ráo; phía ngoài mép bạt (bầu trời, dòng sông) vẫn thấy mưa rơi.
  - Sửa lỗi cắt vùng mưa: trước đây phần nằm ngoài khung nhìn của vùng bạt lại bị vẽ mưa.
- **Kiểm thử:** `test_core.mjs` 213 kiểm tra đều đạt. Kiểm tra mới: ở cấp 4 bạt luôn mở trong suốt cơn mưa; ở cấp 1 bạt vẫn chờ người chơi kéo. Mô phỏng 20 ngày không đổi (bạt chỉ là hình ở các cấp đã có mái che).

## v2.6.4 (17/10): bàn bar giữa lan can, nhóm khách gọn và không trùng mặt
- **Bàn bar dời vào giữa lan can** (`BAR` trong `art/layouts.js`). Hàng chờ xếp bên phải trước (5 chỗ), rồi bên trái (3 chỗ), không đè lên bàn.
- **Thiết kế mới cho bàn bar:**
  - Mặt gỗ hai tông, có viền đen mảnh và vân gỗ; màu gỗ đổi theo cấp Bàn ghế.
  - Khung thép đen chân chữ A, có thanh gác chân.
  - 4 ghế bar tròn, chân inox, có vòng gác chân và đế tròn; màu nệm theo cấp Bàn ghế.
  - Hai đầu bàn có một chậu sen đá và một hộp khăn giấy.
- **Nhóm khách tối đa 3 người:**

  | Loại khách | Số người |
  |---|---|
  | Học trò, dân văn phòng, khách Tây | 1–2 |
  | Cặp đôi, hội bạn, đoàn du lịch | 2 |
  | Gia đình (bố, mẹ, bé) | 3 |
  | TikToker | 1 |

- **Hết cảnh hai người giống hệt nhau:**
  - Người trong nhóm lấy lần lượt các mẫu nhân vật, nên nhóm 2 người luôn là 1 nam 1 nữ (hoặc 2 kiểu khác nhau).
  - Khách giờ có 4 màu áo. Chỉ đổi màu quần áo dưới cổ, không đổi da, tóc hay màu trắng/đen.
  - Hội bạn mặc áo cùng màu (áo nhóm).
  - Giữ nguyên màu đặc trưng của: khách Tây nữ, TikToker, reviewer, chú Tư, cô vé số, shipper, trưởng đoàn.
- **Đánh đổi:** nhóm nhỏ hơn nên mỗi lượt bán ít ly hơn. Mô phỏng 20 ngày (seed 1–2):
  - Lãi tuần đầu giảm khoảng 10–35%.
  - Lãi ngày 8–20 gần như không đổi.
  - Khách bỏ về ít đi.
- **Kiểm thử:** `test_core.mjs` 211 kiểm tra đều đạt, có kiểm tra mới: nhóm ≤ 3 người, 2 người trong nhóm không bao giờ trùng hình và màu áo, bàn bar nằm giữa.
- **Mã sao lưu:** save không đổi định dạng, mã cũ vẫn dùng được.

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
