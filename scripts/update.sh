#!/bin/bash
# 预览版定时生成（未接入任何调度；需要时手动或另行接入）：生成 → 只提交 data/*.json → push 到 ai-radar-map
export TZ=America/New_York PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin
D=/workspace/ai-radar-map; mkdir -p $D/logs; exec >>$D/logs/$(date +%F).log 2>&1
echo "=== $(date '+%F %T %Z')"; set -e; cd $D
curl -s -m3 http://127.0.0.1:4000/health/liveliness >/dev/null || /workspace/ai-stack/start.sh
python3 scripts/build_data.py || { echo "生成失败，保留旧数据"; exit 1; }
# 数据不进公开仓库：推送到 Worker（D1），只有已登录用户可读取
PK=$(cat /workspace/secrets/ai-radar-map_push_key.txt)
for n in events models; do curl -sf -m60 -X POST https://iis-auth.zeta-bat-2030.workers.dev/api/data/$n -H "Content-Type: application/json" -H "X-Push-Key: $PK" --data-binary @data/$n.json || echo "推送 $n 失败"; echo; done
unset PK; echo done
