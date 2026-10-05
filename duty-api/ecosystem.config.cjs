module.exports = {
  apps: [
    {
      name: 'duty-api',
      cwd: '/home/manic/www/duty/duty-api',
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3300,
      },
      watch: false,
      listen_timeout: 10000,
      kill_timeout: 5000,
      max_memory_restart: '512M',
    },
  ],
};
