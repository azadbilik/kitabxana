#!/bin/sh
# One-time setup of a fresh Ubuntu 24.04 server for the production stack, run as root:
#   ssh root@<host> 'sh -s' < deploy/provision.sh "<admin pubkey>" "<ci deploy pubkey>"
# Installs Docker, creates the `deploy` user (the two keys may log in as it), turns off
# password and root SSH logins, opens only SSH (the site arrives through the Cloudflare
# tunnel, which connects out), adds swap, automatic security updates and /opt/irs-az.
set -eu
ADMIN_KEY="$1"
CI_KEY="$2"

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ufw unattended-upgrades fail2ban rsync
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
printf '%s\n%s\n' "$ADMIN_KEY" "$CI_KEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

install -d -o deploy -g deploy /opt/irs-az /opt/irs-az/scans /opt/irs-az/backups
# cloudflared runs as uid 65532 in its container and must read this directory
install -d -m 755 -o deploy -g deploy /opt/irs-az/cloudflared

# 2 GB of swap: the 4 GB box runs Postgres, Meilisearch, Node and Next side by side
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Docker's logs rotate instead of filling the disk
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "3" } }
JSON
systemctl restart docker

cat > /etc/ssh/sshd_config.d/90-kitabxana.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
CONF
systemctl reload ssh

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable

dpkg-reconfigure -f noninteractive unattended-upgrades
echo "provisioned: $(hostname) $(lsb_release -ds)"
