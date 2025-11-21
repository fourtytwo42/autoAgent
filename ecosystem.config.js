require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'autoagent',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/home/hendo420/autoAgent',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ...process.env, // Load all environment variables from .env
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
    },
  ],
};

