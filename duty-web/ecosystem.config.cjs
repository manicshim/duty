module.exports = {
  apps: [
    {
      name: 'duty-web',
      cwd: '/home/manic/www/duty/duty-web',
      script: 'server.cjs',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5050,
        API_TARGET: 'http://127.0.0.1:3300',
      },
      watch: false,
      listen_timeout: 10000,
      kill_timeout: 5000,
      max_memory_restart: '256M',
    },
  ],
};
