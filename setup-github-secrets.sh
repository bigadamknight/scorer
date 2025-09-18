#!/bin/bash

echo "Setting up GitHub Secrets for CI/CD deployment"
echo "================================================"
echo ""
echo "You need to set up the following secrets in your GitHub repository:"
echo "https://github.com/bigadamknight/scorer/settings/secrets/actions"
echo ""
echo "1. SERVER_HOST: 138.199.209.100"
echo "2. SERVER_USER: root"
echo "3. SERVER_SSH_KEY: (Your SSH private key)"
echo ""
echo "To add SERVER_SSH_KEY, copy your private key:"
echo "cat ~/.ssh/id_rsa"
echo ""
echo "Or if using ed25519:"
echo "cat ~/.ssh/id_ed25519"
echo ""
echo "Using GitHub CLI (recommended):"
echo "-------------------------------"
echo ""
echo "gh secret set SERVER_HOST --body '138.199.209.100' --repo bigadamknight/scorer"
echo "gh secret set SERVER_USER --body 'root' --repo bigadamknight/scorer"
echo "gh secret set SERVER_SSH_KEY < ~/.ssh/id_rsa --repo bigadamknight/scorer"
echo ""
echo "Press Enter to run the first two commands automatically..."
read

gh secret set SERVER_HOST --body "138.199.209.100" --repo bigadamknight/scorer
gh secret set SERVER_USER --body "root" --repo bigadamknight/scorer

echo ""
echo "Now you need to manually set the SSH key:"
echo "gh secret set SERVER_SSH_KEY < ~/.ssh/id_rsa --repo bigadamknight/scorer"
echo "(or use id_ed25519 if that's your key type)"