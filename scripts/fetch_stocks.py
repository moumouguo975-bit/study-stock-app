import json
import os
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
import yfinance as yf


def fetch_eastmoney_kline(em_sec_id):
    """直连东方财富获取 A股/港股最新价格与近25日走势"""
    if not em_sec_id:
        return None
    try:
        url = (
            f"https://push2his.eastmoney.com/api/qt/stock/kline/get?"
            f"secid={urllib.parse.quote(em_sec_id)}&fields1=f1,f2,f3,f4,f5,f6"
            f"&fields2=f51,f52,f53,f54,f55,f56&klt=101&fqt=1&end=20500101&lmt=25"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        klines = (data.get("data") or {}).get("klines") or []
        if not klines:
            return None
        dates, closes = [], []
        last_o = last_h = last_l = 0.0
        last_v = 0
        for row in klines:
            parts = row.split(",")
            dates.append(parts[0])
            last_o = round(float(parts[1]), 2)
            closes.append(round(float(parts[2]), 2))
            last_h = round(float(parts[3]), 2)
            last_l = round(float(parts[4]), 2)
            last_v = int(float(parts[5]))
        price = closes[-1]
        prev = closes[-2] if len(closes) >= 2 else price
        change = round(price - prev, 2)
        change_pct = round((change / prev * 100), 2) if prev else 0.0
        return {
            "price": price, "open": last_o, "high": last_h, "low": last_l,
            "volume": last_v, "change": change, "changePct": change_pct,
            "history": closes[-22:], "dates": dates[-22:],
        }
    except Exception as e:
        print(f"[Warn] EM kline failed for {em_sec_id}: {e}")
        return None


def fetch_yahoo_kline(symbol):
    """通过 Yahoo Finance 获取全球股指与个股行情走势"""
    try:
        hist = yf.Ticker(symbol).history(period="1mo")
        if hist is None or hist.empty:
            return None
        hist = hist.dropna(subset=["Close"])
        if len(hist) == 0:
            return None
        closes = [round(float(x), 2) for x in hist["Close"].tolist()]
        dates = [d.strftime("%Y-%m-%d") for d in hist.index]
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
            "change": change, "changePct": change_pct,
            "history": closes[-22:], "dates": dates[-22:],
        }
    except Exception as e:
        print(f"[Warn] YF kline failed for {symbol}: {e}")
        return None


def fetch_best_quote(item):
    q = fetch_eastmoney_kline(item.get("emSecId"))
    if q:
        return q
    return fetch_yahoo_kline(item["symbol"])


def fetch_google_news_rss(query, limit=6):
    items = []
    try:
        encoded = urllib.parse.quote(query)
        url = f"https://news.google.com/rss/search?q={encoded}+when:3d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            root = ET.fromstring(resp.read())
        seen = set()
        for item in root.findall("./channel/item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            src_el = item.find("source")
            source = src_el.text.strip() if src_el is not None and src_el.text else "财经资讯"
            if title and title not in seen:
                seen.add(title)
                items.append({"title": title, "source": source, "time": pub_date[:22], "link": link})
            if len(items) >= limit:
                break
    except Exception as e:
        print(f"[Warn] RSS failed for {query}: {e}")
    return items


def main():
    with open("stocks.json", "r", encoding="utf-8") as f:
        config = json.load(f)

    bj_time = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M (北京时间)")
    output = {
        "updatedAt": bj_time,
        "globalNews": fetch_google_news_rss("A股 美股 港股 全球股市 财经头条", limit=8),
        "indices": [],
        "stocks": [],
    }

    for idx in config.get("indices", []):
        q = fetch_best_quote(idx)
        output["indices"].append({
            **idx,
            **(q or {"price": 0, "change": 0, "changePct": 0, "history": [], "dates": []}),
        })

    for st in config.get("stocks", []):
        q = fetch_best_quote(st)
        news = fetch_google_news_rss(st.get("query", st["name"]), limit=6)
        summary = "\n".join([f"• {n['title']}" for n in news[:3]]) if news else "今日暂无重大异动快讯。"
        output["stocks"].append({
            "symbol": st["symbol"],
            "emSecId": st.get("emSecId", ""),
            "name": st["name"],
            "market": st.get("market", "全球"),
            **(q or {"price": 0, "open": 0, "high": 0, "low": 0, "volume": 0, "change": 0, "changePct": 0, "history": [], "dates": []}),
            "summary": summary,
            "news": news,
        })

    os.makedirs("data", exist_ok=True)
    with open("data/market_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"Updated data/market_data.json at {bj_time}")


if __name__ == "__main__":
    main()
