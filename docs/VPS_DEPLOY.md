# VPS Deployment — aics.iskndr.com

## Live now (by IP)

- Site: http://169.58.37.233/login.html
- API: http://169.58.37.233/api
- Stack: nginx + Node.js API + **PostgreSQL** (Google Sheets removed)

## DNS (required for domain + HTTPS)

At your domain DNS panel for `iskndr.com`, create:

| Type | Name | Value |
|------|------|--------|
| A | `aics` | `169.58.37.233` |

Wait until `nslookup aics.iskndr.com` returns `169.58.37.233`, then on the VPS run:

```bash
certbot --nginx -d aics.iskndr.com --non-interactive --agree-tos -m admin@iskndr.com --redirect
```

After that open: **https://aics.iskndr.com/login.html**

## Logins (PostgreSQL users)

| User | Password | Role |
|------|----------|------|
| `abouamjad` | `Lallas123!` | admin |
| `staff1` | `Staff123!` | employee |
| `eng1` | `Eng123!` | engineer |

## Server paths

- Frontend: `/var/www/toolcustody`
- API: `/opt/toolcustody-api`
- Uploads: `/var/www/toolcustody/uploads`
- Service: `systemctl status toolcustody-api`
- DB: `postgresql://toolcustody@127.0.0.1/toolcustody`

## Security note

Change the VPS root password after setup. Do not commit `deploy-tmp/api.env` to public repos.
