#!/usr/bin/env python3
"""全球AI热点地图数据生成：中英新闻 → LiteLLM 分类/地点/双语摘要 → data/events.json；
LMArena + OpenRouter 公开榜单 → data/models.json。密钥只从环境变量/文件读取。
用法: python3 scripts/build_data.py [--no-llm] [--max N]"""
import json, os, re, sys, time, argparse, urllib.request, html, hashlib
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
R = Path(__file__).resolve().parent.parent; D = R / "data"; D.mkdir(exist_ok=True)
CN = "/workspace/ai-radar/data/cn.json"   # 只读
BASE = os.environ.get("LITELLM_BASE", "http://127.0.0.1:4000")
KEYF = "/workspace/secrets/litellm_master_key.txt"
UA = {"User-Agent": "Mozilla/5.0 ai-radar-map"}
AI_RE = re.compile(r"\bAI\b|A\.I\.|人工智能|大模型|模型|GPT|LLM|Claude|Gemini|DeepSeek|通义|文心|Kimi|豆包|智谱|OpenAI|Anthropic|英伟达|NVIDIA|Nvidia|算力|智能体|agent|AIGC|Sora|Llama|Qwen|Mistral|机器人|robot|neural|machine learning|deep learning|chatbot|Copilot|xAI|Grok", re.I)
CACHE = str(R / ".cache_llm.json")
CATS = ["model", "funding", "policy", "paper", "product"]
# 国家中心坐标（地点只由国家码映射，避免模型编造坐标）
GEO = {"US":(39.8,-98.6),"CN":(35.0,104.2),"GB":(54.0,-2.0),"FR":(46.6,2.4),"DE":(51.2,10.4),"JP":(36.2,138.3),"KR":(36.5,127.9),
 "IN":(21.0,78.0),"CA":(56.1,-106.3),"IL":(31.0,34.9),"SG":(1.35,103.8),"AE":(24.0,54.0),"SA":(24.0,45.0),"TW":(23.7,121.0),"HK":(22.3,114.2),
 "RU":(61.5,105.3),"BR":(-14.2,-51.9),"AU":(-25.3,133.8),"NL":(52.1,5.3),"SE":(60.1,18.6),"CH":(46.8,8.2),"IT":(41.9,12.6),"ES":(40.5,-3.7),
 "EU":(50.8,4.4),"IE":(53.4,-8.2),"FI":(61.9,25.7),"PL":(51.9,19.1),"VN":(14.1,108.3),"ID":(-0.8,113.9),"TR":(39.0,35.2),"MX":(23.6,-102.6),
 "ZA":(-30.6,22.9),"NG":(9.1,8.7),"EG":(26.8,30.8),"KE":(-0.0,37.9),"AR":(-38.4,-63.6),"NZ":(-40.9,174.9),"TH":(15.9,100.9),"MY":(4.2,102.0)}
CITY = {"San Francisco":(37.77,-122.42),"Seattle":(47.6,-122.33),"New York":(40.71,-74.0),"Beijing":(39.9,116.4),"Shanghai":(31.23,121.47),
 "Shenzhen":(22.54,114.06),"Hangzhou":(30.27,120.15),"London":(51.5,-0.12),"Paris":(48.86,2.35),"Tokyo":(35.68,139.69),"Seoul":(37.57,126.98),
 "Bangalore":(12.97,77.59),"Toronto":(43.65,-79.38),"Tel Aviv":(32.08,34.78),"Berlin":(52.52,13.4),"Washington":(38.9,-77.04),"Brussels":(50.85,4.35),
 "Mountain View":(37.39,-122.08),"Cupertino":(37.32,-122.03),"Redmond":(47.67,-122.12),"Santa Clara":(37.35,-121.95),"Austin":(30.27,-97.74),
 "Guangzhou":(23.13,113.26),"Taipei":(25.03,121.57),"Singapore":(1.29,103.85),"Dubai":(25.2,55.27),"Hong Kong":(22.32,114.17),"Zurich":(47.37,8.54)}
RSS = [("TechCrunch AI","https://techcrunch.com/category/artificial-intelligence/feed/"),
       ("The Verge AI","https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
       ("VentureBeat AI","https://venturebeat.com/category/ai/feed/"),
       ("MIT Tech Review","https://www.technologyreview.com/topic/artificial-intelligence/feed"),
       ("arXiv cs.AI","https://rss.arxiv.org/rss/cs.AI")]

def get(u, t=20):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
def log(*a): print(*a, file=sys.stderr)

def collect(maxn):
    out, seen = [], set()
    def add(title, url, src, lang, ts=None):
        title = html.unescape(re.sub(r"<[^>]+>", "", title or "")).strip()
        if not title or title in seen or not url: return
        seen.add(title); out.append({"id": hashlib.md5(url.encode()).hexdigest()[:10], "title": title, "url": url, "src": src, "lang": lang, "ts": ts})
    try:
        d = json.load(open(CN, encoding="utf-8")); now = d.get("updated")
        for p in d["platforms"]:
            for it in p.get("items", []):
                if p.get("id") == "juejin_ai" or AI_RE.search(it.get("title", "")): add(it["title"], it.get("url"), p["name"], "zh", now)
    except Exception as e: log("cn.json 失败", e)
    for name, u in RSS:
        try:
            root = ET.fromstring(get(u)); n = 0
            for it in root.iter():
                tag = it.tag.split("}")[-1]
                if tag not in ("item", "entry"): continue
                f = {c.tag.split("}")[-1]: c for c in it}
                link = f.get("link"); link = (link.text or link.get("href")) if link is not None else None
                date = next((f[k].text for k in ("pubDate", "published", "updated", "date") if k in f), None)
                ts = None
                if date:
                    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S%z"):
                        try: ts = int(datetime.strptime(date.strip().replace("Z", "+00:00").replace("GMT", "+0000"), fmt).timestamp() * 1000); break
                        except Exception: pass
                t = f["title"].text if "title" in f else ""
                if name.startswith("arXiv") or AI_RE.search(t or ""): add(t, (link or "").strip(), name, "en", ts); n += 1
                if n >= 15: break
            log(name, n)
        except Exception as e: log(name, "失败", type(e).__name__)
    try:
        hn = json.load(urllib.request.urlopen("https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&numericFilters=points>40", timeout=20))
        for h in hn["hits"][:20]:
            if AI_RE.search(h.get("title", "")): add(h["title"], h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}", "Hacker News", "en", h["created_at_i"] * 1000)
    except Exception as e: log("HN 失败", e)
    # 中英交替截取，保证全球化
    zh = [x for x in out if x["lang"] == "zh"]; en = [x for x in out if x["lang"] == "en"]
    mix = [x for pair in zip(zh, en) for x in pair] + zh[len(en):] + en[len(zh):]
    return mix[:maxn]

def key():
    k = os.environ.get("LITELLM_API_KEY")
    if not k and os.path.exists(KEYF): k = open(KEYF).read().strip()
    return k

def llm(prompt, k, models=("free", "nemotron-ultra", "free", "nemotron-lightning")):
    for m in models:
        try:
            body = json.dumps({"model": m, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2, "max_tokens": 5000,
                               "response_format": {"type": "json_object"}}).encode()
            r = json.load(urllib.request.urlopen(urllib.request.Request(BASE + "/v1/chat/completions", data=body,
                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + k}), timeout=120))
            msg = r["choices"][0]["message"]; t = msg.get("content") or msg.get("reasoning_content") or ""
            j = parse_any(t)
            if not j.get("items"): raise ValueError("无 items")
            return j, r.get("model", m)
        except Exception as e:
            log(f"  [{m}] {type(e).__name__}: {str(e)[:80]}")
            if "429" in str(e): time.sleep(25)
            else: time.sleep(3)
    return None, None

def parse_any(t):
    t = re.sub(r"```(?:json)?", "", t); t = re.sub(r",\s*([}\]])", r"\1", t)
    dec = json.JSONDecoder(); objs = []; i = 0
    while True:
        i = t.find("{", i)
        if i < 0: break
        try: o, e = dec.raw_decode(t, i); objs.append(o); i = e
        except Exception: i += 1
    for o in objs:
        if isinstance(o, dict) and isinstance(o.get("items"), list): return o
    its = [o for o in objs if isinstance(o, dict) and "i" in o]
    return {"items": its}

PROMPT = """You are an AI-news analyst. For each numbered headline, output JSON {"items":[{"i":N,"cat":"model|funding|policy|paper|product|other","country":"ISO2 code of where the event happens or the main company HQ, e.g. US CN GB FR; EU for EU-wide; null if unknown","city":"English city name or null","org":"main company/org name or null","zh":"<=40字中文摘要","en":"<=25-word English summary"}]}.
Rules: only use facts in the headline, never invent numbers or names. If not really AI-related use cat "other".
Headlines:
"""

def enrich(items, use_llm):
    k = key() if use_llm else None
    models_used = set()
    for x in items: x.update(cat="other", country=None, city=None, org=None, zh=x["title"] if x["lang"] == "zh" else "", en=x["title"] if x["lang"] == "en" else "")
    if not k:
        log("无密钥或 --no-llm：仅规则分类")
        for x in items:
            rule(x); ll = GEO.get(x["country"])
            if ll: h = int(x["id"], 16); x["lat"] = round(ll[0] + ((h % 100) - 50) / 60, 3); x["lng"] = round(ll[1] + ((h // 100 % 100) - 50) / 60, 3)
        return items, []
    from concurrent.futures import ThreadPoolExecutor
    B = 8; batches = [items[s:s+B] for s in range(0, len(items), B)]
    def run(b): return llm(PROMPT + "\n".join(f"{i}. [{x['src']}] {x['title']}" for i, x in enumerate(b)), k)
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    todo = [b for b in batches if not all(x["id"] in cache for x in b)]
    log(f"缓存命中 {sum(1 for x in items if x['id'] in cache)} 条，待处理批次 {len(todo)}")
    fails = 0
    for b in todo:
        if fails >= 3: log("连续失败3批，停止调用（限流）"); break
        j, m = run(b)
        if not j: fails += 1; continue
        fails = 0; models_used.add(m)
        for r in j.get("items", []):
            try: x = b[int(r["i"])]
            except Exception: continue
            r["_m"] = m; cache[x["id"]] = r
        json.dump(cache, open(CACHE, "w"), ensure_ascii=False)
        time.sleep(3)
    results = [({"items": [dict(cache[x["id"]], i=n) for n, x in enumerate(b) if x["id"] in cache]}, "cache") for b in batches]
    for n, (batch, (j, m)) in enumerate(zip(batches, results)):
        log(f"批次 {n+1}: {'ok '+str(m) if j else '失败'}")
        if not j["items"]: continue
        for r in j.get("items", []):
            try: x = batch[int(r["i"])]
            except Exception: continue
            x["cat"] = r.get("cat") if r.get("cat") in CATS else "other"
            c = (r.get("country") or "").upper()
            x["country"] = c if c in GEO else None
            x["city"] = r.get("city") if r.get("city") in CITY else None
            x["org"] = None if str(r.get("org")).lower() in ("null","none","","unknown") else r.get("org")
            x["zh"] = (r.get("zh") or x["zh"])[:80]; x["en"] = (r.get("en") or x["en"])[:200]
            x["llm"] = True; models_used.add(r.get("_m"))
    for x in items:
        if not x.get("llm"): rule(x)
        ll = CITY.get(x["city"]) or GEO.get(x["country"])
        if ll:
            h = int(x["id"], 16); x["lat"] = round(ll[0] + ((h % 100) - 50) / 60, 3); x["lng"] = round(ll[1] + ((h // 100 % 100) - 50) / 60, 3)
    return items, sorted(m for m in models_used if m and m != "cache")

ORGC = {"OpenAI":"US","Anthropic":"US","Google":"US","Gemini":"US","DeepMind":"GB","Meta":"US","Microsoft":"US","Copilot":"US","Apple":"US","Amazon":"US","NVIDIA":"US","英伟达":"US","Nvidia":"US","xAI":"US","Grok":"US","Tesla":"US","特斯拉":"US",
 "Mistral":"FR","法国":"FR","DeepSeek":"CN","阿里":"CN","通义":"CN","Qwen":"CN","百度":"CN","文心":"CN","腾讯":"CN","字节":"CN","豆包":"CN","Kimi":"CN","月之暗面":"CN","智谱":"CN","小米":"CN","华为":"CN","美团":"CN","京东":"CN","李佳琦":"CN","红果":"CN","郑州":"CN","横店":"CN",
 "Samsung":"KR","三星":"KR","SoftBank":"JP","软银":"JP","Sony":"JP","TSMC":"TW","台积电":"TW","EU":"EU","欧盟":"EU","UK":"GB","英国":"GB","India":"IN","印度":"IN","日本":"JP","韩国":"KR","美国":"US","Character.AI":"US","Hugging Face":"US","Perplexity":"US"}
RULES = [("funding", r"融资|估值|投资|收购|IPO|上市|raises?|funding|valuation|acquir|invest|\$\d+\s?[MB]"),("policy", r"政策|监管|法规|法案|禁令|政府|部委|标准|安全|lawsuit|regulat|policy|law|ban|government|senate|court|EU\b"),
 ("paper", r"论文|研究|arXiv|benchmark|基准|paper|study|research"),("model", r"发布.*模型|模型.*发布|开源|GPT-?\d|Claude|Gemini|Llama|Qwen|DeepSeek|model|LLM"),("product", r".")]
def rule(x):
    t = x["title"]
    x["cat"] = "paper" if x["src"].startswith("arXiv") else next(c for c, p in RULES if re.search(p, t, re.I))
    for k, c in ORGC.items():
        if k.lower() in t.lower():
            x["country"] = c; x["org"] = x["org"] or (k if k[0].isascii() and k not in ("UK","EU","India") else None); break
    if not x["country"] and x["src"].startswith("arXiv"): x["country"] = None
    x["rule"] = True

def models():
    res = {"lmarena": [], "openrouter": [], "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    try:
        import pandas as pd, io
        df = pd.read_parquet(io.BytesIO(get("https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main/text/latest-00000-of-00001.parquet", 60)))
        df = df[df.category == "overall"].sort_values("rank").head(15)
        res["lmarena"] = [{"rank": int(r["rank"]), "model": r.model_name, "org": r.organization, "score": round(float(r.rating)), "votes": int(r.vote_count),
                           "date": str(r.leaderboard_publish_date)} for _, r in df.iterrows()]
        res["lmarena_src"] = "https://lmarena.ai/leaderboard/text"; res["lmarena_data"] = "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset"
    except Exception as e: log("LMArena 失败", e)
    try:
        s = get("https://openrouter.ai/rankings", 30).decode().replace('\\"', '"')
        i = s.find('"queryKey":["rankings","benchmarks"]'); j = s.find('"queryKey":["rankings","models"', i)
        rows = re.findall(r'\{"date":"([^"]+)","model_permaslug":"([^"]+)","variant":"[^"]*","total_completion_tokens":(\d+),"total_prompt_tokens":(\d+)', s[i:j])
        agg = {}
        for d_, slug, c, p in rows:
            base = re.sub(r"-\d{8}$", "", slug); agg[base] = agg.get(base, 0) + int(c) + int(p)
        top = sorted(agg.items(), key=lambda kv: -kv[1])[:15]
        res["openrouter"] = [{"rank": n+1, "model": m, "tokens": t, "url": "https://openrouter.ai/" + m} for n, (m, t) in enumerate(top)]
        res["openrouter_src"] = "https://openrouter.ai/rankings"; res["openrouter_range"] = f"{min(r[0] for r in rows)[:10]} ~ {max(r[0] for r in rows)[:10]}" if rows else ""
    except Exception as e: log("OpenRouter 失败", e)
    return res

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--no-llm", action="store_true"); ap.add_argument("--max", type=int, default=90); a = ap.parse_args()
    t0 = time.time(); items = collect(a.max); log("采集", len(items))
    items, used = enrich(items, not a.no_llm)
    if not a.no_llm and not any(x.get("llm") for x in items) and (D / "events.json").exists(): sys.exit("LLM 全部失败，保留旧 events.json")
    ev = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "models_used": used, "count": len(items), "items": items}
    (D / "events.json").write_text(json.dumps(ev, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    m = models()
    if m["lmarena"] or m["openrouter"]: (D / "models.json").write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"完成 {len(items)} 条，定位 {sum(1 for x in items if 'lat' in x)}，LLM {sum(1 for x in items if x.get('llm'))}，模型 {used}，{time.time()-t0:.0f}s")

if __name__ == "__main__": main()
