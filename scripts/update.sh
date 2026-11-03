#!/bin/bash
# 预览版定时生成（未接入任何调度；需要时手动或另行接入）：生成 → 只提交 data/*.json → push 到 ai-radar-map
export TZ=America/New_York PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin
D=/workspace/ai-radar-map; mkdir -p $D/logs; exec >>$D/logs/$(date +%F).log 2>&1
echo "=== $(date '+%F %T %Z')"; set -e; cd $D
curl -s -m3 http://127.0.0.1:4000/health/liveliness >/dev/null || /workspace/ai-stack/start.sh
git pull -q --rebase origin main || true
python3 scripts/build_data.py || { echo "生成失败，保留旧数据"; exit 1; }
git add data/events.json data/models.json; git diff --cached --quiet && exit 0
git -c user.name=zeta-bat-2030 -c user.email=zeta-bat-2030@users.noreply.github.com commit -qm "data $(date '+%F %H:%M')" && git push -q origin main
for f in events models; do curl -s -m10 https://purge.jsdelivr.net/gh/zeta-bat-2030/ai-radar-map@main/data/$f.json >/dev/null; done; echo done
