# 互联网情报系统 · Internet Intelligence System（预览版）
全球 AI 热点实时地图：3D 地球（globe.gl，低端设备自动降级 2D）、实时事件流、国家/公司统计、LMArena/OpenRouter 模型榜、中英全文搜索（MiniSearch）、中英切换。
- 数据：`scripts/build_data.py`（本机 LiteLLM）→ 本地 `data/*.json`（已 gitignore）→ `scripts/update.sh` 推送到 Worker
- 构建：`python3 scripts/build.py`（src/ → index.html）
- 鉴权与数据：Cloudflare Worker `iis-auth` + D1（`worker/`）。管理员审批制；数据只对已登录用户返回，不在公开仓库中。
