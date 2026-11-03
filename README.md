# 互联网情报系统 · Internet Intelligence System（预览版）
全球 AI 热点实时地图：3D 地球（globe.gl，低端设备自动降级 2D）、实时事件流、国家/公司统计、LMArena/OpenRouter 模型榜、中英全文搜索（MiniSearch）、中英切换。
- 数据：`scripts/build_data.py`（本机 LiteLLM 分类/定位/双语摘要）→ `data/events.json`、`data/models.json`
- 构建：`python3 scripts/build.py`（src/ → index.html）
- 登录仅为前端本地门禁（PBKDF2 哈希存 localStorage），不是真正的安全措施。
