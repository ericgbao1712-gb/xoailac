# Mã sao lưu từ các bản cũ

`backup-codes.json`: mã sao lưu (XOAILAC1.…) do chính từng bản cũ tạo ra (dùng `encodeSave` của bản đó, chạy trong trình duyệt).
Mỗi save được lấy từ một quán chơi thật 5 ngày bằng bot, sau đó được cho thêm tiền, lên Lv 26 và mua mọi đồ trang trí / nâng cấp mà bản đó có.

| Khóa | Bản |
|---|---|
| dc4d517 | Bản gốc trước v2 (save v1) |
| d14db27 | v2 đợt 1 |
| ee7e010 | v2.1 |
| 60dd040 | v2.2 |
| 813726b | v2.3 |
| 41cb6d2 | v2.4 |
| 19329ff | v2.5 |

`test_core.mjs` (mục 16) giải mã từng mã bằng `decodeSave` hiện tại, nạp vào game mới và chạy thử một ngày. Mục đích: người chơi dán mã cũ vẫn chơi tiếp được bản mới.
Khi ra bản mới, thêm mã do bản đó tạo vào đây; không sửa hay xóa các mã cũ.
