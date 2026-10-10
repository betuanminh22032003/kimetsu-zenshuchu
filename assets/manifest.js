// Danh sách ảnh trong assets/ — thêm tên file vào đây khi bạn bỏ ảnh mới (GitHub Actions tự tạo lại file này khi deploy).
window.ASSET_FILES = [];
// Nơi tải asset: mặc định 'assets/' (cùng GitHub Pages). Khi deploy, GitHub Actions đổi sang CDN jsDelivr nếu có asset.
window.ASSET_BASE = window.ASSET_BASE || 'assets/';
