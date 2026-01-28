/**
 * PM2 Configuration for EvoNash Web Application
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart evonash
 *   pm2 logs evonash
 *   pm2 stop evonash
 */
module.exports = {
  apps: [{
    name: 'evonash',
    script: '.next/standalone/server.js',
    cwd: '/opt/evonash/web',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Logging
    error_file: '/var/log/evonash/error.log',
    out_file: '/var/log/evonash/out.log',
    log_file: '/var/log/evonash/combined.log',
    time: true
  }]
}
