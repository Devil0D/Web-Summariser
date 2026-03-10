"""
test_api.py  —  quick smoke-tests for the Summarizer API
Run with:  python test_api.py
(server must already be running on localhost:8000)
"""

import httpx, json, sys

BASE = "http://localhost:8000"
SAMPLE = (
    "Artificial intelligence is transforming industries worldwide. "
    "From healthcare to finance, AI-powered systems are automating repetitive tasks, "
    "improving decision-making accuracy, and enabling entirely new products. "
    "However, concerns about job displacement, bias in algorithms, and data privacy "
    "remain significant challenges that researchers and policymakers are actively addressing. "
    "The next decade will likely see AI become as foundational as electricity in modern economies."
)


def check(label, resp):
    icon = "✅" if resp.status_code == 200 else "❌"
    print(f"{icon}  {label}  [{resp.status_code}]")
    if resp.status_code != 200:
        print("   ", resp.text)
    else:
        data = resp.json()
        # print summary snippet if present
        s = data.get("summary", "")
        if s:
            print(f"    → {s[:120]}{'…' if len(s)>120 else ''}")
    return resp.status_code == 200


client = httpx.Client(timeout=120)   # models can be slow on first load
ok = True

# 1. health
ok &= check("GET  /health",  client.get(f"{BASE}/health"))

# 2. models list
ok &= check("GET  /models",  client.get(f"{BASE}/models"))

# 3. BART
ok &= check("POST /summarize  (bart)",
    client.post(f"{BASE}/summarize", json={"text": SAMPLE, "model": "bart"}))

# 4. T5
ok &= check("POST /summarize  (t5)",
    client.post(f"{BASE}/summarize", json={"text": SAMPLE, "model": "t5"}))

# 5. LexRank
ok &= check("POST /summarize  (lexrank)",
    client.post(f"{BASE}/summarize", json={"text": SAMPLE, "model": "lexrank"}))

# 6. file upload (txt)
ok &= check("POST /summarize/file  (.txt)",
    client.post(
        f"{BASE}/summarize/file",
        files={"file": ("test.txt", SAMPLE.encode(), "text/plain")},
        params={"model": "bart"},
    ))

# 7. bad model name — should return 400
r = client.post(f"{BASE}/summarize", json={"text": SAMPLE, "model": "gpt99"})
ok &= check("POST /summarize  (bad model → expect 400)",
    type("FakeResp", (), {"status_code": 400 if r.status_code==400 else 0,
                          "text": r.text, "json": r.json})())

print()
print("All tests passed ✅" if ok else "Some tests FAILED ❌")
sys.exit(0 if ok else 1)
