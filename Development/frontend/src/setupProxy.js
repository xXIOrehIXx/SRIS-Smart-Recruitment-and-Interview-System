const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 5082 = cổng HTTP của backend (launchSettings.json — có ở cả profile http lẫn https).
  // 7048 là cổng HTTPS, không dùng ở đây vì proxy gọi bằng http.
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5082',
      changeOrigin: true,
      secure: false,
    })
  );
};
