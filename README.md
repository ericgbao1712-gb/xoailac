# Xoài Lắc Ơi! — mã nguồn bản thử v2.6.21

Đây là toàn bộ mã nguồn của bản chơi thử mới nhất (17/10/2026), đúng như bản đang chạy trên link chơi thử.
Chi tiết từng bản v2 → v2.6 ở `CHANGELOG.md` (mới nhất: **thanh lý hàng cũ** ở Kho ▸ Thanh lý).

## Trong gói có gì

| Đường dẫn | Là gì |
|---|---|
| `web/xoailac/` | Game: `index.html`, `style.css`, `src/` (JavaScript ES modules, không cần build), `assets/` (ảnh pixel) |
| `web/xoai-lac-ban-thu.html` | Trang giới thiệu bản thử (danh sách tính năng mới, nút "Thử nhanh" nạp save mẫu). Trang này nằm cạnh thư mục `xoailac/` |
| `tools/xoailac/test_core.mjs` | 320 kiểm thử phần lõi (chạy bằng Node, không cần trình duyệt) |
| `tools/xoailac/sim.mjs` | Mô phỏng cân bằng: bot chơi N ngày rồi in lãi, khách, cấp quán |
| `tools/xoailac/fixtures/` | Mã sao lưu do chính các bản cũ tạo ra, để kiểm tra mã cũ vẫn dùng được |
| `tools/art/` | Script Python vẽ icon pixel (vật tư, món ăn kèm, thiết bị, linh vật, đèn lồng) và ghép vào `assets/icons.png` |
| `CHANGELOG.md` | Nhật ký thay đổi từ v2 đến v2.6.21 |

## Chạy thử trên máy

Game dùng ES modules nên phải mở qua một web server, mở thẳng file `index.html` (file://) sẽ không chạy.

```bash
cd web
python3 -m http.server 8765
# mở http://localhost:8765/xoailac/            → vào game
# mở http://localhost:8765/xoai-lac-ban-thu.html → trang giới thiệu bản thử
```

Thêm `#debug` vào cuối địa chỉ game (`/xoailac/#debug`) để hiện bảng debug: thêm tiền, lên cấp, gọi khách, đổi thời tiết.

## Chạy kiểm thử và mô phỏng (Node 18 trở lên)

```bash
cd tools/xoailac
node test_core.mjs            # in "OK 320 checks" nếu tất cả đều đạt
SUMMARY=1 node sim.mjs 20 1   # 20 ngày, seed 1
```

## Mã sao lưu bản cũ vẫn dùng được

- Định dạng mã (`XOAILAC1.…`) không đổi từ bản gốc.
- Khi khôi phục, save cũ được nâng cấp tự động trong `src/core/state.js` (`migrate`).
- Không mất tiến trình. Đồ đã bị gỡ khỏi game (tranh treo tường, đồ Đặc biệt, bàn dư) được hoàn tiền đúng giá đã mua.
- Đã thử thật: mã do 7 bản (từ bản gốc v1 đến v2.5) tạo ra đều khôi phục được, cả ở màn mở đầu ("Có mã sao lưu?") lẫn trong Cài đặt, và chơi tiếp bình thường.
- Mục 16 trong `test_core.mjs` kiểm tra lại việc này mỗi lần chạy.

## Đưa lên MeeGame

- Game cài được như ứng dụng (Android "Cài đặt", iOS "Thêm vào MH chính") nhờ `manifest.json`, `sw.js` và icon trong `assets/app/`. Trang phải chạy qua HTTPS (hoặc localhost) thì mới cài được.

- Chép thư mục `web/xoailac/` vào chỗ của game trên server.
- Khi đổi file ảnh trong `assets/`, tăng `ASSET_VER` trong `src/art/assets.js`.
- Khi đổi `style.css`, tăng `CSS_VER` trong `src/main.js`.
- Các file `.js` chưa có số phiên bản trong đường dẫn: nếu CDN cache lâu, người chơi cần tải lại trang (Ctrl+Shift+R) sau khi cập nhật.

