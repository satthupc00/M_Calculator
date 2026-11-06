# M Calc

Máy tính giao diện tối cho Samsung Galaxy Z Fold 7 (Android). Created by Mondiro.

- Màn ngoài: bàn phím gọn, bấm biểu tượng đồng hồ để mở lịch sử.
- Màn trong: lịch sử luôn hiện bên trái, có thêm phím khoa học (√, x², π, xʸ, n!).
- Xem trước kết quả khi đang gõ, lưu 200 phép tính, vuốt ngang để xoá.
- Tự kiểm tra bản mới trên GitHub Releases và cài đè.

## Cài đặt
Tải file `M-Calc-vX.Y.Z.apk` ở mục **Releases** rồi mở trên điện thoại.

## Phát hành bản mới
1. Tăng `version` trong `package.json`.
2. Cập nhật `www/whatsnew.json` cho đúng bản đó.
3. Push lên GitHub → GitHub Actions tự build APK và tạo Release.

Chữ ký app nằm trong GitHub Secrets `MCALC_KEYSTORE_B64` và `MCALC_KS_PASS` (không lưu trong repo).
