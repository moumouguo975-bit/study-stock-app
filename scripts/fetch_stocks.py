import json
import os
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
import yfinance as yf


def fetch_quote_and_chart(symbol):
    """获取最新价格、今开/最高/最低/成交量，以及近1个月每日收盘走势数据"""
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1mo")
        if hist is None or hist.empty:
            return None
        hist = hist.dropna(subset=["Close"])
        if len(hist) == 0:
            return None

        closes = [round(float(x), 2) for x in hist["Close"].tolist()]
        dates = [d.strftime("%m-%d") for d in hist.index]
        last = hist.iloc[-1]
        price = round(float(last["Close"]), 2)
        prev = round(float(hist["Close"].iloc[-2]), 2) if len(hist) >= 2 else price
        change = round(price - prev, 2)
        change_pct = round((change / prev * 100), 2) if prev else 0.0

        return {
            "price": price,
            "open": round(float(last["Open"]), 2),
            "high": round(float(last["High"]), 2),
            "low": round(float(last["Low"]), 2),
            "volume": int(last["Volume"]) if last["Volume"] == last["Volume"] else 0,
            "change": change,
            "changePct": change_pct,
            "history": closes[-22:],
            "dates": dates[-22:],
        }
    except Exception as e:
        print(f"[Warn] Failed quote for {symbol}: {e}")
        return None


def fetch_google_news_rss(query, limit=6):
    """抓取中文 Google News 每日最新财经消息"""
    items = []
    try:
        encoded = urllib.parse.quote(query)
        url = f"https://news.google.com/rss/search?q={encoded}+when:3d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            xml_data = resp.read()
        root = ET.fromstring(xml_data)
        seen = set()
        for item in root.findall("./channel/item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            source_el = item.find("source")
            source = source_el.text.strip() if source_el is not None and source_el.text else "财经资讯"
            if title and title not in seen:
                seen.add(title)
                items.append({
                    "title": title,
                    "source": source,
                    "time": pub_date[:22],
                    "link": link,
                })
            if len(items) >= limit:
                break
    except Exception as e:
        print(f"[Warn] RSS failed for {query}: {e}")
    return items


def fetch_yf_news(symbol, limit=5):
    """补充抓取 Yahoo Finance 国际快讯"""
    items = []
    try:
        raw_news = yf.Ticker(symbol).news or []
        for n in raw_news[:limit]:
            content = n.get("content", n)
            title = content.get("title", "")
            provider = content.get("provider", {})
            source = provider.get("displayName", "Yahoo Finance") if isinstance(provider, dict) else content.get("publisher", "Yahoo")
            canon = content.get("canonicalUrl", {})
            link = canon.get("url", "") if isinstance(canon, dict) else content.get("link", "")
            pub = content.get("pubDate", "")[:16].replace("T", " ")
            if title:
                items.append({"title": title, "source": source, "time": pub, "link": link})
    except Exception as e:
        print(f"[Warn] YF news failed for {symbol}: {e}")
    return items


def main():
    with open("stocks.json", "r", encoding="utf-8") as f:
        config = json.load(f)

    bj_time = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M (北京时间)")
    output = {
        "updatedAt": bj_time,
        "globalNews": fetch_google_news_rss("全球股市 美股 A股 港股 财经头条", limit=8),
        "indices": [],
        "stocks": [],
    }

    for idx in config.get("indices", []):
        q = fetch_quote_and_chart(idx["symbol"])
        output["indices"].append({
            **idx,
            **(q or {"price": 0, "change": 0, "changePct": 0, "history": [], "dates": []}),
        })

    for st in config.get("stocks", []):
        q = fetch_quote_and_chart(st["symbol"])
        news = fetch_google_news_rss(st.get("query", st["name"]), limit=6)
        if len(news) < 3:
            news.extend(fetch_yf_news(st["symbol"], limit=4))

        if news:
            summary_lines = [f"• {n['title']}" for n in news[:3]]
            daily_summary = "\n".join(summary_lines)
        else:
            daily_summary = "今日暂无重大异动快讯。"

        output["stocks"].append({
            "symbol": st["symbol"],
            "name": st["name"],
            "market": st.get("market", "全球"),
            **(q or {"price": 0, "open": 0, "high": 0, "low": 0, "volume": 0, "change": 0, "changePct": 0, "history": [], "dates": []}),
            "summary": daily_summary,
            "news": news[:6],
        })

    os.makedirs("data", exist_ok=True)
    with open("data/market_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"Updated data/market_data.json at {bj_time}")


if __name__ == "__main__":
    main()
