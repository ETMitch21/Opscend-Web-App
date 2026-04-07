module.exports = {
  "/api/v1": {
    target: "http://127.0.0.1:3001",
    secure: true,
    changeOrigin: false,
    logLevel: "debug",
    pathRewrite: { "^/api": "" },

    onProxyReq: (proxyReq, req) => {
      // This is the browser host the user hit (what we need for tenancy)
      const incomingHost = req.headers.host;

      // Log to Angular dev server console (terminal running ng serve)
      console.log("[proxy] incoming host:", incomingHost);

      if (incomingHost) proxyReq.setHeader("x-forwarded-host", incomingHost);

      // Optional but nice
      proxyReq.setHeader("x-forwarded-proto", "http");
    },
  },
};