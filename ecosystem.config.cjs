// PM2 process config for the Hostinger VPS (Node.js).
// Usage on the server:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup    # makes PM2 boot with the system
module.exports = {
  apps: [
    {
      name: "torneio-manoamano",
      script: ".output/server/index.mjs",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "127.0.0.1",
      },
    },
  ],
};
