# DutyFlow Deploy

Build and run with pm2:

```bash
npm run build --prefix duty-api
npm run build --prefix duty-web
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

Cloudflare DNS:

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ZONE_ID="..."
export DUTY_SERVER_IP="your-public-ip"
bash deploy/cloudflare-upsert-dns.sh
```

WSL2 host port forwarding, run in Administrator PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\wsl2-portproxy.ps1
```

Nginx and Certbot:

```bash
sudo cp deploy/nginx/duty.manic.kr.conf /etc/nginx/sites-available/duty.manic.kr
sudo ln -sf /etc/nginx/sites-available/duty.manic.kr /etc/nginx/sites-enabled/duty.manic.kr
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d duty.manic.kr
sudo systemctl list-timers | grep certbot
```
