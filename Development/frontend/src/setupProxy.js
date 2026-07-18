const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 5082 = cổng HTTP của backend (launchSettings.json — có ở cả profile http lẫn https).
  // 7048 là cổng HTTPS, không dùng ở đây vì proxy gọi bằng http.
  // KHÔNG mount qua app.use('/api', ...) — Express cắt mất prefix /api trước khi
  // forward (backend sẽ 404). Dùng pathFilter để giữ nguyên đường dẫn đầy đủ.
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:5082',
      changeOrigin: true,
      secure: false,
      pathFilter: '/api',
    })
  );
};
