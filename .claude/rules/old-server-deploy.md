---
paths:
  - ".github/workflows/ci-cd.yml"
  - "setup-github-secrets.sh"
---

## Server Development & Deployment Guide

### Directory Structure
- **Development workspace**: `/root/dev/scorer` - GitHub-synced repository for development
- **Production deployment**: `/var/www/apps/scorer-prod` - Live production build
- **Development deployment**: `/var/www/apps/scorer-dev` - Development/staging build
- **Original app**: `/var/www/netball-scorer` - Previous developed version (currently serving scorer.momentumnetball.co.uk)

### Branch Strategy
- **main branch**: Production - deployed automatically via GitHub Actions
- **dev branch**: Development - for testing and staging

### Development Workflow

#### Working on Dev Branch
```bash
cd /root/dev/scorer
git checkout dev
git pull origin dev

# Make your changes
# ...

# Build and test locally
yarn install --ignore-engines
yarn build

# Deploy to dev environment for testing
rsync -av --delete apps/web/dist/ /var/www/apps/scorer-dev/

# View at: http://138.199.209.100/scorer-dev/
```

#### Deploying to Production
```bash
cd /root/dev/scorer

# Option 1: Merge dev to main locally
git checkout main
git pull origin main
git merge dev
git push origin main
# GitHub Actions will auto-deploy to production

# Option 2: Use the deploy script
/root/deploy.sh prod
# This pulls main from GitHub and deploys to /var/www/apps/scorer-prod/
```

### Using the Deploy Script
Located at `/root/deploy.sh`:
- `deploy.sh dev` - Build and deploy current dev branch to dev environment
- `deploy.sh prod` - Build and deploy main branch to production
- `deploy.sh merge` - Merge dev to main and deploy to production
- `deploy.sh status` - Show git status and current branch

### URLs & Access Points
- **Production (via domain)**: https://scorer.momentumnetball.co.uk/ → `/var/www/netball-scorer/`
- **Production (via IP)**: http://138.199.209.100/scorer/ → `/var/www/apps/scorer-prod/`
- **Development**: http://138.199.209.100/scorer-dev/ → `/var/www/apps/scorer-dev/`

### GitHub Integration
- **Repository**: https://github.com/bigadamknight/scorer (public)
- **CI/CD**: GitHub Actions runs on push to main/dev branches
- **Auto-deployment**: Pushes to main branch trigger production deployment

### Important Notes
1. Always pull latest changes before starting work: `git pull origin dev`
2. The production domain (scorer.momentumnetball.co.uk) currently points to the original app at `/var/www/netball-scorer/`
3. To update the domain to point to the new deployment, modify `/etc/nginx/sites-available/scorer-domain`
4. SSL certificates are already configured for the domain
5. Node version on server: 20.19.5, Yarn: 1.22.22

### Quick Commands
```bash
# Check current deployment status
cd /root/dev/scorer && git status

# View nginx logs
tail -f /var/log/nginx/scorer.error.log

# Restart nginx after config changes
nginx -t && systemctl reload nginx

# Check which branch you're on
git branch --show-current

# See recent commits
git log --oneline -5
```
