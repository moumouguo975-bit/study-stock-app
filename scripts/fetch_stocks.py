import json
import os
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
import yfinance as yf


def fetch_quote(symbol):
    """获取最新价格与涨跌幅"""
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="5d")
        if hist is None or hist.empty:
            return None
        closes = hist["Close"].dropna()
        if len(closes) == 0:
            return None
        price = float(closes.iloc[-1])
        prev = float(closes.iloc[-2]) if len(closes) >= 2 else price
        change = price - prev
        change_pct = (change / prev * 100) if prev else 0.0
        return {
            "price": round(price, 2),
            "change": round(change, 2),
            "changePct": round(change_pct, 2),
        }
    except Exception as e:
        print(f"[Warn] Failed quote for {symbol}: {e}")
        return None


def fetch_google_news_rss(query, limit=5):
    """通过 Google News 中文 RSS 抓取每日最新消息"""
    items = []
    try:
        encoded = urllib.parse.quote(query)
        url = f"https://news.google.com/rss/search?q={encoded}+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            xml_data = resp.read()
        root = ET.fromstring(xml_data)
        for item in root.findall("./channel/item")[:limit]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            source_el = item.find("source")
            source = source_el.text.strip() if source_el is not None and source_el.text else "财经资讯"
            if title:
                items.append({
                    "title": title,
                    "source": source,
                    "time": pub_date[:22],
                    "link": link,
                })
    except Exception as e:
        print(f"[Warn] RSS failed for {query}: {e}")
    return items


def fetch_yf_news(symbol, limit=4):
    """备用：从 Yahoo Finance 获取英文/国际快讯"""
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
                items.append({
                    "title": title,
                    "source": source,
                    "time": pub,
                    "link": link,
                })
    except Exception as e:
        print(f"[Warn] YF news failed for {symbol}: {e}")
    return items


def main():
    with open("stocks.json", "r", encoding="utf-8") as f:
        config = json.load(f)

    bj_time = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M (北京时间)")
    output = {
        "updatedAt": bj_time,
        "indices": [],
        "stocks": [],
    }

    for idx in config.get("indices", []):
        q = fetch_quote(idx["symbol"])
        output["indices"].append({
            **idx,
            "price": q["price"] if q else 0,
            "change": q["change"] if q else 0,
            "changePct": q["changePct"] if q else 0,
        })

    for st in config.get("stocks", []):
        q = fetch_quote(st["symbol"])
        news = fetch_google_news_rss(st.get("query", st["name"]), limit=5)
        if not news:
            news = fetch_yf_news(st["symbol"], limit=4)

        if news:
            summary_lines = [f"• {n['title']}" for n in news[:3]]
            daily_summary = "今日焦点：\n" + "\n".join(summary_lines)
        else:
            daily_summary = "今日暂无重大异动快讯。"

        output["stocks"].append({
            "symbol": st["symbol"],
            "name": st["name"],
            "market": st.get("market", "全球"),
            "price": q["price"] if q else 0,
            "change": q["change"] if q else 0,
            "changePct": q["changePct"] if q else 0,
            "summary": daily_summary,
            "news": news,
        })

    os.makedirs("data", exist_ok=True)
    with open("data/market_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"Updated data/market_data.json at {bj_time}")


if __name__ == "__main__":
    main()
