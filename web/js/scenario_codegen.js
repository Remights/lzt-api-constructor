// ==================== ГЕНЕРАЦИЯ СКРИПТА-БОТА ====================
// Вынесено из scenario.js для читаемости. Методы подмешиваются в window.Scenario.
// Генерация одиночного запроса (модалка) живёт в codegen.js (window.Codegen).
(function () {
    "use strict";
    if (!window.Scenario) { console.error("scenario_codegen: window.Scenario не найден"); return; }
    Object.assign(window.Scenario, {
    // ==================== ГЕНЕРАЦИЯ СКРИПТА-БОТА ====================

    regenScript() {
        const out = document.getElementById("script-output");
        if (!out) return;
        const gen = {
            python: () => this.generatePython(),
            python_async: () => this.generatePythonAsync(),
            node: () => this.generateNode(),
            bash: () => this.generateBash(),
            php: () => this.generatePHP(),
            csharp: () => this.generateCSharp(),
            go: () => this.generateGo(),
        }[this.scriptLang] || (() => this.generatePython());
        out.textContent = gen();
    },

    // Упорядоченный список исполняемых нод (без «Старт») и стартовая нода
    flow() {
        const start = this.nodes.find(n => n.type === "start");
        return {
            startTarget: start ? this.edgeTarget(start.id, "out") : null,
            nodes: this.nodes.filter(n => n.type !== "start"),
        };
    },

    py(str) { return JSON.stringify(str); },

    generatePython() {
        const start = this.nodes.find(n => n.type === "start");
        const startTarget = start ? this.edgeTarget(start.id, "out") : null;
        const L = [];
        L.push("import requests, time, re");
        L.push("");
        L.push('TOKEN = "ВСТАВЬТЕ_ВАШ_ТОКЕН"');
        L.push('HEADERS = {"Authorization": f"Bearer {TOKEN}"}');
        L.push('context = {"last": None, "vars": {}, "proxy": None}');
        L.push("counters = {}");
        L.push("proxy_state = {}");
        L.push("");
        L.push("def get_path(obj, path):");
        L.push("    cur = obj");
        L.push("    for p in [x.strip() for x in path.split('.') if x.strip()]:");
        L.push("        if cur is None: return None");
        L.push("        if p == 'length' and isinstance(cur, list): cur = len(cur); continue");
        L.push("        if isinstance(cur, list):");
        L.push("            try: cur = cur[int(p)]");
        L.push("            except: return None");
        L.push("        elif isinstance(cur, dict): cur = cur.get(p)");
        L.push("        else: return None");
        L.push("    return cur");
        L.push("");
        L.push("def resolve(val):");
        L.push("    if isinstance(val, str):");
        L.push("        return re.sub(r'\\{\\{\\s*([^}]+)\\s*\\}\\}', lambda m: str(get_path(context, m.group(1).strip()) or ''), val)");
        L.push("    if isinstance(val, list): return [resolve(v) for v in val]");
        L.push("    if isinstance(val, dict): return {k: resolve(v) for k, v in val.items()}");
        L.push("    return val");
        L.push("");
        L.push("def _num(v):");
        L.push("    try: return float(v)");
        L.push("    except: return float('nan')");
        L.push("");
        L.push("def make_proxies():");
        L.push("    p = context.get('proxy')");
        L.push("    if not p: return None");
        L.push("    if '://' not in p:");
        L.push("        parts = p.split(':')");
        L.push("        if len(parts) == 4: p = 'http://%s:%s@%s:%s' % (parts[2], parts[3], parts[0], parts[1])");
        L.push("        else: p = 'http://' + p");
        L.push("    return {'http': p, 'https': p}");
        L.push("");
        L.push("def notify(channel, text, tg_token='', tg_chat='', discord_url=''):");
        L.push("    try:");
        L.push("        if channel in ('telegram','both') and tg_token and tg_chat:");
        L.push("            requests.post('https://api.telegram.org/bot%s/sendMessage' % tg_token, json={'chat_id': tg_chat, 'text': text}, timeout=15)");
        L.push("        if channel in ('discord','both') and discord_url:");
        L.push("            requests.post(discord_url, json={'content': text}, timeout=15)");
        L.push("    except Exception as e:");
        L.push("        print('Ошибка уведомления:', e)");
        L.push("");
        L.push("def save_to_file(value, filename, fmt):");
        L.push("    import csv, json as _json");
        L.push("    if value is None: print('Нечего сохранять в', filename); return");
        L.push("    if fmt == 'csv':");
        L.push("        rows = value if isinstance(value, list) else [value]");
        L.push("        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:");
        L.push("            if rows and all(isinstance(r, dict) for r in rows):");
        L.push("                cols = []");
        L.push("                for r in rows:");
        L.push("                    for k in r.keys():");
        L.push("                        if k not in cols: cols.append(k)");
        L.push("                w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore'); w.writeheader()");
        L.push("                for r in rows: w.writerow({k: (_json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v) for k, v in r.items()})");
        L.push("            else:");
        L.push("                w = csv.writer(f); w.writerow(['value'])");
        L.push("                for r in rows: w.writerow([r])");
        L.push("    else:");
        L.push("        with open(filename, 'w', encoding='utf-8') as f: _json.dump(value, f, ensure_ascii=False, indent=2)");
        L.push("    print('Сохранён файл', filename)");
        L.push("");
        L.push("def do_request(method, url, params=None, data=None, retries=0, retry_delay=1000, timeout=15, respect_rl=True):");
        L.push("    attempt = 0");
        L.push("    rl_wait = 0");
        L.push("    while True:");
        L.push("        try:");
        L.push("            r = requests.request(method, url, params=params, data=data, headers=HEADERS, proxies=make_proxies(), timeout=timeout)");
        L.push("            if r.status_code == 429 and respect_rl and rl_wait < 8:");
        L.push("                ra = r.headers.get('Retry-After')");
        L.push("                wait = int(ra) if (ra and ra.isdigit()) else min(30, 2 ** rl_wait * 2)");
        L.push("                print('429 rate limit, ждём', wait, 'с'); time.sleep(wait); rl_wait += 1; continue");
        L.push("            if not r.ok and attempt < retries:");
        L.push("                attempt += 1; time.sleep(retry_delay / 1000 * attempt);");
        L.push("                print('Повтор', attempt, 'из', retries); continue");
        L.push("            return r");
        L.push("        except Exception as e:");
        L.push("            if attempt < retries:");
        L.push("                attempt += 1; time.sleep(retry_delay / 1000 * attempt);");
        L.push("                print('Повтор после ошибки:', e); continue");
        L.push("            raise");
        L.push("");
        L.push(`node = ${startTarget ? this.py(startTarget) : "None"}`);
        L.push("steps = 0");
        L.push("while node and steps < 300:");
        L.push("    steps += 1");

        const reqNodes = this.nodes.filter(n => n.type !== "start");
        if (!reqNodes.length || !startTarget) {
            L.push("    break");
        }

        let first = true;
        this.nodes.forEach(node => {
            if (node.type === "start") return;
            const kw = first ? "if" : "elif"; first = false;
            L.push(`    ${kw} node == ${this.py(node.id)}:`);
            if (node.type === "request") {
                const req = node.request || {};
                L.push(`        # ${this.pyComment(req.title || "Запрос")}`);
                L.push(`        url = resolve(${this.py(req.url || "https://prod-api.lzt.market/steam")})`);
                L.push(`        params = resolve(${this.pyDict(req.params || {})})`);
                const rp = `retries=${req.retries || 0}, retry_delay=${req.retryDelay || 1000}, timeout=${req.timeout || 15}, respect_rl=${req.respectRateLimit !== false ? "True" : "False"}`;
                if (req.body && Object.keys(req.body).length) {
                    L.push(`        data = resolve(${this.pyDict(req.body)})`);
                    L.push(`        r = do_request(${this.py(req.method || "GET")}, url, params=params, data=data, ${rp})`);
                } else {
                    L.push(`        r = do_request(${this.py(req.method || "GET")}, url, params=params, ${rp})`);
                }
                L.push(`        print("[${req.method}]", url, "->", r.status_code)`);
                L.push("        try: context['last'] = r.json()");
                L.push("        except: context['last'] = None");
                const succ = this.edgeTarget(node.id, "success");
                const err = this.edgeTarget(node.id, "error");
                L.push(`        node = ${succ ? this.py(succ) : "None"} if r.ok else ${this._errNext(node.id, "error")}`);
            } else if (node.type === "condition") {
                const c = node.condition;
                const t = this.edgeTarget(node.id, "true");
                const f = this.edgeTarget(node.id, "false");
                L.push(`        _l = get_path(context, ${this.py(c.left)})`);
                if (c.op === "exists") {
                    L.push("        _ok = _l is not None and _l != ''");
                } else if (c.op === "==" || c.op === "!=") {
                    L.push(`        _ok = (str(_l) ${c.op} ${this.py(c.right)})`);
                } else {
                    L.push("        try: _ok = (float(_l) " + c.op + " float(" + this.py(c.right) + "))");
                    L.push("        except: _ok = False");
                }
                L.push(`        node = ${t ? this.py(t) : "None"} if _ok else ${f ? this.py(f) : "None"}`);
            } else if (node.type === "loop") {
                const b = this.edgeTarget(node.id, "body");
                const d = this.edgeTarget(node.id, "done");
                L.push(`        counters[${this.py(node.id)}] = counters.get(${this.py(node.id)}, 0)`);
                L.push(`        if counters[${this.py(node.id)}] < ${node.loop.times}:`);
                L.push(`            counters[${this.py(node.id)}] += 1`);
                L.push(`            node = ${b ? this.py(b) : "None"}`);
                L.push("        else:");
                L.push(`            counters[${this.py(node.id)}] = 0`);
                L.push(`            node = ${d ? this.py(d) : "None"}`);
            } else if (node.type === "variable") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        context['vars'][${this.py(node.variable.name)}] = get_path(context, ${this.py(node.variable.path)})`);
                L.push(`        node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "filter") {
                const f = node.filter;
                const found = this.edgeTarget(node.id, "found");
                const empty = this.edgeTarget(node.id, "empty");
                L.push(`        _arr = get_path(context, ${this.py(f.source)}) or []`);
                L.push(`        _res = [x for x in _arr if isinstance(x, dict) and ${this.pyFilterExpr(f)}]`);
                L.push(`        context['vars'][${this.py(f.saveAs)}] = _res`);
                L.push("        context['last'] = _res");
                L.push(`        node = ${found ? this.py(found) : "None"} if _res else ${empty ? this.py(empty) : "None"}`);
            } else if (node.type === "notify") {
                const n = node.notify;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        notify(${this.py(n.channel)}, resolve(${this.py(n.text)}), ${this.py(n.tgToken)}, ${this.py(n.tgChat)}, ${this.py(n.discordUrl)})`);
                L.push(`        node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "logmsg") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        print(resolve(${this.py(node.logmsg.text)}))`);
                L.push(`        node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "savefile") {
                const s = node.savefile;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        save_to_file(get_path(context, ${this.py(s.source)}), ${this.py(s.filename + "." + s.format)}, ${this.py(s.format)})`);
                L.push(`        node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "proxy") {
                const nx = this.edgeTarget(node.id, "out");
                const list = (node.proxy.list || "").split("\n").map(s => s.trim()).filter(Boolean);
                L.push(`        _plist = ${"[" + list.map(x => this.py(x)).join(", ") + "]"}`);
                if (node.proxy.mode === "random") {
                    L.push("        import random");
                    L.push("        context['proxy'] = random.choice(_plist) if _plist else None");
                } else {
                    L.push(`        _i = proxy_state.get(${this.py(node.id)}, 0)`);
                    L.push("        context['proxy'] = _plist[_i % len(_plist)] if _plist else None");
                    L.push(`        proxy_state[${this.py(node.id)}] = _i + 1`);
                }
                L.push(`        node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "delay") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        time.sleep(${(node.delay.ms || 0) / 1000})`);
                L.push(`        node = ${nx ? this.py(nx) : "None"}`);
            } else if (this._cgExtNode(node, "py", "        ", L)) {
                /* foreach / checker / sniper / subscenario */
            } else if (node.type === "stop") {
                L.push("        node = None");
            }
        });

        if (!first) {
            L.push("    else:");
            L.push("        node = None");
        }
        L.push("");
        L.push('print("Сценарий завершён.")');
        return L.join("\n");
    },

    // Python-выражение фильтра для одного элемента x (dict)
    pyFilterExpr(f) {
        const field = this.py(f.field);
        const val = this.py(f.value);
        if (f.op === "exists") return `x.get(${field}) is not None`;
        if (f.op === "==" ) return `str(x.get(${field})) == ${val}`;
        if (f.op === "!=") return `str(x.get(${field})) != ${val}`;
        // числовые сравнения безопасно
        const cmp = { ">": ">", "<": "<", ">=": ">=", "<=": "<=" }[f.op] || "==";
        return `(_num(x.get(${field})) ${cmp} _num(${val}))`;
    },

    // JS-выражение фильтра для элемента x
    jsFilterExpr(f) {
        const field = this.py(f.field);
        const val = this.py(f.value);
        if (f.op === "exists") return `x[${field}] != null`;
        if (f.op === "==") return `String(x[${field}]) === ${val}`;
        if (f.op === "!=") return `String(x[${field}]) !== ${val}`;
        const cmp = { ">": ">", "<": "<", ">=": ">=", "<=": "<=" }[f.op] || "==";
        return `parseFloat(x[${field}]) ${cmp} parseFloat(${val})`;
    },

    pyComment(s) { return String(s).replace(/[\r\n]+/g, " ").slice(0, 80); },

    pyDict(obj) {
        const parts = Object.entries(obj).map(([k, v]) => {
            let val;
            if (Array.isArray(v)) val = "[" + v.map(x => this.py(String(x))).join(", ") + "]";
            else val = this.py(String(v));
            return `${this.py(k)}: ${val}`;
        });
        return "{" + parts.join(", ") + "}";
    },

    // Универсальный литерал «карты строк» для JS/PHP/Go/C#
    mapLiteral(obj, style) {
        const entries = Object.entries(obj);
        if (style === "js") {
            return "{" + entries.map(([k, v]) => `${this.py(k)}: ${Array.isArray(v) ? "[" + v.map(x => this.py(String(x))).join(", ") + "]" : this.py(String(v))}`).join(", ") + "}";
        }
        if (style === "php") {
            return "[" + entries.map(([k, v]) => `${this.py(k)} => ${Array.isArray(v) ? "[" + v.map(x => this.py(String(x))).join(", ") + "]" : this.py(String(v))}`).join(", ") + "]";
        }
        return "";
    },

    // ---------- Python (async / aiohttp) ----------
    generatePythonAsync() {
        const { startTarget } = this.flow();
        const L = [];
        L.push("import asyncio, re, aiohttp");
        L.push("");
        L.push('TOKEN = "ВСТАВЬТЕ_ВАШ_ТОКЕН"');
        L.push('HEADERS = {"Authorization": f"Bearer {TOKEN}"}');
        L.push('context = {"last": None, "vars": {}, "proxy": None}');
        L.push("counters = {}");
        L.push("proxy_state = {}");
        L.push("");
        L.push("def get_path(obj, path):");
        L.push("    cur = obj");
        L.push("    for p in [x.strip() for x in path.split('.') if x.strip()]:");
        L.push("        if cur is None: return None");
        L.push("        if p == 'length' and isinstance(cur, list): cur = len(cur); continue");
        L.push("        if isinstance(cur, list):");
        L.push("            try: cur = cur[int(p)]");
        L.push("            except: return None");
        L.push("        elif isinstance(cur, dict): cur = cur.get(p)");
        L.push("        else: return None");
        L.push("    return cur");
        L.push("");
        L.push("def _num(v):");
        L.push("    try: return float(v)");
        L.push("    except: return float('nan')");
        L.push("");
        L.push("def cur_proxy():");
        L.push("    p = context.get('proxy')");
        L.push("    if not p: return None");
        L.push("    if '://' not in p:");
        L.push("        parts = p.split(':')");
        L.push("        if len(parts) == 4: p = 'http://%s:%s@%s:%s' % (parts[2], parts[3], parts[0], parts[1])");
        L.push("        else: p = 'http://' + p");
        L.push("    return p");
        L.push("");
        L.push("def resolve(val):");
        L.push("    if isinstance(val, str):");
        L.push("        return re.sub(r'\\{\\{\\s*([^}]+)\\s*\\}\\}', lambda m: str(get_path(context, m.group(1).strip()) or ''), val)");
        L.push("    if isinstance(val, list): return [resolve(v) for v in val]");
        L.push("    if isinstance(val, dict): return {k: resolve(v) for k, v in val.items()}");
        L.push("    return val");
        L.push("");
        L.push("async def notify(session, channel, text, tg_token='', tg_chat='', discord_url=''):");
        L.push("    try:");
        L.push("        if channel in ('telegram','both') and tg_token and tg_chat:");
        L.push("            await session.post('https://api.telegram.org/bot%s/sendMessage' % tg_token, json={'chat_id': tg_chat, 'text': text})");
        L.push("        if channel in ('discord','both') and discord_url:");
        L.push("            await session.post(discord_url, json={'content': text})");
        L.push("    except Exception as e:");
        L.push("        print('Ошибка уведомления:', e)");
        L.push("");
        L.push("async def main():");
        L.push(`    node = ${startTarget ? this.py(startTarget) : "None"}`);
        L.push("    steps = 0");
        L.push("    async with aiohttp.ClientSession(headers=HEADERS) as session:");
        L.push("        while node and steps < 300:");
        L.push("            steps += 1");
        let first = true;
        this.nodes.forEach(node => {
            if (node.type === "start") return;
            const kw = first ? "if" : "elif"; first = false;
            L.push(`            ${kw} node == ${this.py(node.id)}:`);
            if (node.type === "request") {
                const req = node.request || {};
                const m = (req.method || "GET").toLowerCase();
                L.push(`                url = resolve(${this.py(req.url)})`);
                L.push(`                params = resolve(${this.pyDict(req.params || {})})`);
                const succ = this.edgeTarget(node.id, "success");
                const err = this.edgeTarget(node.id, "error");
                if (req.body && Object.keys(req.body).length) {
                    L.push(`                data = resolve(${this.pyDict(req.body)})`);
                    L.push(`                async with session.${m}(url, params=params, data=data, proxy=cur_proxy()) as r:`);
                } else {
                    L.push(`                async with session.${m}(url, params=params, proxy=cur_proxy()) as r:`);
                }
                L.push(`                    print("[${req.method}]", url, "->", r.status)`);
                L.push("                    try: context['last'] = await r.json(content_type=None)");
                L.push("                    except: context['last'] = None");
                L.push("                    ok = r.status < 400");
                L.push(`                node = ${succ ? this.py(succ) : "None"} if ok else ${this._errNext(node.id, "error")}`);
            } else if (node.type === "condition") {
                const c = node.condition;
                const t = this.edgeTarget(node.id, "true");
                const f = this.edgeTarget(node.id, "false");
                L.push(`                _l = get_path(context, ${this.py(c.left)})`);
                if (c.op === "exists") L.push("                _ok = _l is not None and _l != ''");
                else if (c.op === "==" || c.op === "!=") L.push(`                _ok = (str(_l) ${c.op} ${this.py(c.right)})`);
                else { L.push("                try: _ok = (float(_l) " + c.op + " float(" + this.py(c.right) + "))"); L.push("                except: _ok = False"); }
                L.push(`                node = ${t ? this.py(t) : "None"} if _ok else ${f ? this.py(f) : "None"}`);
            } else if (node.type === "loop") {
                const b = this.edgeTarget(node.id, "body");
                const d = this.edgeTarget(node.id, "done");
                L.push(`                counters[${this.py(node.id)}] = counters.get(${this.py(node.id)}, 0)`);
                L.push(`                if counters[${this.py(node.id)}] < ${node.loop.times}:`);
                L.push(`                    counters[${this.py(node.id)}] += 1`);
                L.push(`                    node = ${b ? this.py(b) : "None"}`);
                L.push("                else:");
                L.push(`                    counters[${this.py(node.id)}] = 0`);
                L.push(`                    node = ${d ? this.py(d) : "None"}`);
            } else if (node.type === "variable") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                context['vars'][${this.py(node.variable.name)}] = get_path(context, ${this.py(node.variable.path)})`);
                L.push(`                node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "filter") {
                const f = node.filter;
                const found = this.edgeTarget(node.id, "found");
                const empty = this.edgeTarget(node.id, "empty");
                L.push(`                _arr = get_path(context, ${this.py(f.source)}) or []`);
                L.push(`                _res = [x for x in _arr if isinstance(x, dict) and ${this.pyFilterExpr(f)}]`);
                L.push(`                context['vars'][${this.py(f.saveAs)}] = _res`);
                L.push("                context['last'] = _res");
                L.push(`                node = ${found ? this.py(found) : "None"} if _res else ${empty ? this.py(empty) : "None"}`);
            } else if (node.type === "notify") {
                const n = node.notify;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                await notify(session, ${this.py(n.channel)}, resolve(${this.py(n.text)}), ${this.py(n.tgToken)}, ${this.py(n.tgChat)}, ${this.py(n.discordUrl)})`);
                L.push(`                node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "logmsg") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                print(resolve(${this.py(node.logmsg.text)}))`);
                L.push(`                node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "savefile") {
                const s = node.savefile;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                import json as _json`);
                L.push(`                _val = get_path(context, ${this.py(s.source)})`);
                L.push(`                open(${this.py(s.filename + "." + s.format)}, 'w', encoding='utf-8').write(_json.dumps(_val, ensure_ascii=False, indent=2))`);
                L.push(`                print('Сохранён файл', ${this.py(s.filename + "." + s.format)})`);
                L.push(`                node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "proxy") {
                const nx = this.edgeTarget(node.id, "out");
                const list = (node.proxy.list || "").split("\n").map(s => s.trim()).filter(Boolean);
                L.push(`                _plist = ${"[" + list.map(x => this.py(x)).join(", ") + "]"}`);
                if (node.proxy.mode === "random") {
                    L.push("                import random");
                    L.push("                context['proxy'] = random.choice(_plist) if _plist else None");
                } else {
                    L.push(`                _i = proxy_state.get(${this.py(node.id)}, 0)`);
                    L.push("                context['proxy'] = _plist[_i % len(_plist)] if _plist else None");
                    L.push(`                proxy_state[${this.py(node.id)}] = _i + 1`);
                }
                L.push(`                node = ${nx ? this.py(nx) : "None"}`);
            } else if (node.type === "delay") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                await asyncio.sleep(${(node.delay.ms || 0) / 1000})`);
                L.push(`                node = ${nx ? this.py(nx) : "None"}`);
            } else if (this._cgExtNode(node, "pyasync", "                ", L)) {
                /* extended */
            } else if (node.type === "stop") {
                L.push("                node = None");
            }
        });
        if (!first) { L.push("            else:"); L.push("                node = None"); }
        L.push("");
        L.push('    print("Сценарий завершён.")');
        L.push("");
        L.push('if __name__ == "__main__":');
        L.push("    asyncio.run(main())");
        return L.join("\n");
    },

    // ---------- Node.js (axios) ----------
    generateNode() {
        const { startTarget } = this.flow();
        const L = [];
        L.push("const axios = require('axios');");
        L.push("");
        L.push('const TOKEN = "ВСТАВЬТЕ_ВАШ_ТОКЕН";');
        L.push('const HEADERS = { Authorization: `Bearer ${TOKEN}` };');
        L.push("const context = { last: null, vars: {} };");
        L.push("const counters = {};");
        L.push("const sleep = (ms) => new Promise(r => setTimeout(r, ms));");
        L.push("");
        L.push("function getPath(obj, path) {");
        L.push("  let cur = obj;");
        L.push("  for (const p of String(path).split('.').map(s => s.trim()).filter(Boolean)) {");
        L.push("    if (cur == null) return undefined;");
        L.push("    if (p === 'length' && Array.isArray(cur)) { cur = cur.length; continue; }");
        L.push("    cur = cur[p];");
        L.push("  }");
        L.push("  return cur;");
        L.push("}");
        L.push("function resolve(val) {");
        L.push("  if (typeof val === 'string') return val.replace(/\\{\\{\\s*([^}]+)\\s*\\}\\}/g, (m, p) => { const v = getPath(context, p.trim()); return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); });");
        L.push("  if (Array.isArray(val)) return val.map(resolve);");
        L.push("  if (val && typeof val === 'object') { const o = {}; for (const k in val) o[k] = resolve(val[k]); return o; }");
        L.push("  return val;");
        L.push("}");
        L.push("");
        L.push("(async () => {");
        L.push(`  let node = ${startTarget ? this.py(startTarget) : "null"};`);
        L.push("  let steps = 0;");
        L.push("  while (node && steps < 300) {");
        L.push("    steps++;");
        this.nodes.forEach(node => {
            if (node.type === "start") return;
            L.push(`    if (node === ${this.py(node.id)}) {`);
            if (node.type === "request") {
                const req = node.request || {};
                const succ = this.edgeTarget(node.id, "success");
                const err = this.edgeTarget(node.id, "error");
                L.push(`      const url = resolve(${this.py(req.url)});`);
                L.push(`      const params = resolve(${this.mapLiteral(req.params || {}, "js")});`);
                L.push("      let ok = false;");
                L.push("      try {");
                if (req.body && Object.keys(req.body).length) {
                    L.push(`        const data = resolve(${this.mapLiteral(req.body, "js")});`);
                    L.push(`        const r = await axios({ method: ${this.py((req.method || "GET").toLowerCase())}, url, params, data, headers: HEADERS });`);
                } else {
                    L.push(`        const r = await axios({ method: ${this.py((req.method || "GET").toLowerCase())}, url, params, headers: HEADERS });`);
                }
                L.push(`        console.log("[${req.method}]", url, "->", r.status);`);
                L.push("        context.last = r.data; ok = r.status < 400;");
                L.push("      } catch (e) { context.last = e.response ? e.response.data : null; ok = false; }");
                L.push(`      node = ok ? ${succ ? this.py(succ) : "null"} : ${this._errNextJs(node.id, "error")};`);
            } else if (node.type === "condition") {
                const c = node.condition;
                const t = this.edgeTarget(node.id, "true");
                const f = this.edgeTarget(node.id, "false");
                L.push(`      const _l = getPath(context, ${this.py(c.left)});`);
                let expr;
                if (c.op === "exists") expr = "(_l !== undefined && _l !== null && _l !== '')";
                else if (c.op === "==" ) expr = `(String(_l) === ${this.py(c.right)})`;
                else if (c.op === "!=") expr = `(String(_l) !== ${this.py(c.right)})`;
                else expr = `(parseFloat(_l) ${c.op} parseFloat(${this.py(c.right)}))`;
                L.push(`      const _ok = ${expr};`);
                L.push(`      node = _ok ? ${t ? this.py(t) : "null"} : ${f ? this.py(f) : "null"};`);
            } else if (node.type === "loop") {
                const b = this.edgeTarget(node.id, "body");
                const d = this.edgeTarget(node.id, "done");
                L.push(`      counters[${this.py(node.id)}] = counters[${this.py(node.id)}] || 0;`);
                L.push(`      if (counters[${this.py(node.id)}] < ${node.loop.times}) { counters[${this.py(node.id)}]++; node = ${b ? this.py(b) : "null"}; }`);
                L.push(`      else { counters[${this.py(node.id)}] = 0; node = ${d ? this.py(d) : "null"}; }`);
            } else if (node.type === "variable") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`      context.vars[${this.py(node.variable.name)}] = getPath(context, ${this.py(node.variable.path)});`);
                L.push(`      node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "logmsg") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`      console.log(${this.py(node.logmsg.text)});`);
                L.push(`      node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "savefile") {
                const s = node.savefile;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`      require('fs').writeFileSync(${this.py(s.filename + "." + s.format)}, JSON.stringify(getPath(context, ${this.py(s.source)}), null, 2));`);
                L.push(`      console.log('Сохранён файл ${s.filename}.${s.format}');`);
                L.push(`      node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "notify") {
                const n = node.notify;
                const nx = this.edgeTarget(node.id, "out");
                if (n.channel === "discord" || n.channel === "both") L.push(`      await axios.post(${this.py(n.discordUrl)}, { content: ${this.py(n.text)} }).catch(()=>{});`);
                if (n.channel === "telegram" || n.channel === "both") L.push(`      await axios.post(\`https://api.telegram.org/bot${"${" + this.py(n.tgToken) + "}"}/sendMessage\`, { chat_id: ${this.py(n.tgChat)}, text: ${this.py(n.text)} }).catch(()=>{});`);
                L.push(`      node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "filter") {
                const f = node.filter;
                const found = this.edgeTarget(node.id, "found");
                const empty = this.edgeTarget(node.id, "empty");
                L.push(`      { const _arr = getPath(context, ${this.py(f.source)}) || []; const _res = _arr.filter(x => x && ${this.jsFilterExpr(f)}); context.vars[${this.py(f.saveAs)}] = _res; context.last = _res; node = _res.length ? ${found ? this.py(found) : "null"} : ${empty ? this.py(empty) : "null"}; }`);
            } else if (node.type === "proxy") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`      // Прокси: настройте axios-агент вручную (см. https-proxy-agent). Список: ${this.pyComment((node.proxy.list || "").replace(/\n/g, ", "))}`);
                L.push(`      node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "delay") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`      await sleep(${node.delay.ms || 0});`);
                L.push(`      node = ${nx ? this.py(nx) : "null"};`);
            } else if (this._cgExtNode(node, "node", "      ", L)) {
                /* extended */
            } else if (node.type === "stop") {
                L.push("      node = null;");
            }
            L.push("      continue;");
            L.push("    }");
        });
        L.push("    node = null;");
        L.push("  }");
        L.push('  console.log("Сценарий завершён.");');
        L.push("})();");
        return L.join("\n");
    },

    // ---------- Bash (curl) ----------
    // Линейный проход: условия/ветвления в чистом bash громоздки, поэтому
    // генерируем последовательную цепочку по «успешному» пути с пометками.
    generateBash() {
        const { startTarget } = this.flow();
        const L = [];
        L.push("#!/usr/bin/env bash");
        L.push("# Сценарий LZT API. Для сложных ветвлений используйте Python/Node — bash показывает основной путь.");
        L.push('TOKEN="ВСТАВЬТЕ_ВАШ_ТОКЕН"');
        L.push('AUTH="Authorization: Bearer $TOKEN"');
        L.push("");
        const visited = new Set();
        let cur = startTarget;
        let idx = 0;
        while (cur && !visited.has(cur) && idx < 100) {
            visited.add(cur); idx++;
            const node = this.getNode(cur);
            if (!node) break;
            if (node.type === "request") {
                const req = node.request || {};
                const qs = Object.entries(req.params || {}).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(",") : v)}`).join("&");
                const url = req.url + (qs ? (req.url.includes("?") ? "&" : "?") + qs : "");
                L.push(`# ${this.pyComment(req.title || "Запрос")}`);
                let line = `curl -s -X ${req.method} "${url}" -H "$AUTH"`;
                if (req.body && Object.keys(req.body).length) {
                    const bodyStr = Object.entries(req.body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
                    line += ` --data "${bodyStr}"`;
                }
                L.push(line);
                L.push("");
                cur = this.edgeTarget(node.id, "success");
            } else if (node.type === "condition") {
                L.push(`# УСЛОВИЕ: ${node.condition.left} ${node.condition.op} ${node.condition.right} — проверьте вручную (ветка «Да»)`);
                L.push("");
                cur = this.edgeTarget(node.id, "true");
            } else if (node.type === "loop") {
                L.push(`# ЦИКЛ ×${node.loop.times}: в bash оформите как 'for i in $(seq 1 ${node.loop.times}); do ... done' вокруг блоков тела`);
                L.push("");
                cur = this.edgeTarget(node.id, "body") || this.edgeTarget(node.id, "done");
            } else if (node.type === "variable") {
                L.push(`# ПЕРЕМЕННАЯ ${node.variable.name} = ${node.variable.path} (извлеките через jq из ответа)`);
                L.push("");
                cur = this.edgeTarget(node.id, "out");
            } else if (node.type === "logmsg") {
                L.push(`echo ${this.py(node.logmsg.text)}`);
                L.push("");
                cur = this.edgeTarget(node.id, "out");
            } else if (node.type === "savefile") {
                L.push(`# СОХРАНЕНИЕ: выгрузите ${node.savefile.source} в ${node.savefile.filename}.${node.savefile.format} (например через jq)`);
                L.push("");
                cur = this.edgeTarget(node.id, "out");
            } else if (node.type === "notify") {
                const n = node.notify;
                if (n.channel === "telegram" || n.channel === "both") L.push(`curl -s -X POST "https://api.telegram.org/bot${n.tgToken}/sendMessage" -d chat_id=${n.tgChat} --data-urlencode text=${this.py(n.text)} > /dev/null`);
                if (n.channel === "discord" || n.channel === "both") L.push(`curl -s -X POST ${this.py(n.discordUrl)} -H "Content-Type: application/json" -d '{"content": ${JSON.stringify(n.text)}}' > /dev/null`);
                L.push("");
                cur = this.edgeTarget(node.id, "out");
            } else if (node.type === "filter") {
                L.push(`# ФИЛЬТР: оставить из ${node.filter.source}, где ${node.filter.field} ${node.filter.op} ${node.filter.value} (используйте jq)`);
                L.push("");
                cur = this.edgeTarget(node.id, "found") || this.edgeTarget(node.id, "empty");
            } else if (node.type === "proxy") {
                L.push(`# ПРОКСИ: добавьте к curl флаг -x (напр. -x ${((node.proxy.list || "").split("\n")[0] || "host:port").trim()})`);
                L.push("");
                cur = this.edgeTarget(node.id, "out");
            } else if (node.type === "delay") {
                L.push(`sleep ${(node.delay.ms || 0) / 1000}`);
                L.push("");
                cur = this.edgeTarget(node.id, "out");
            } else if (node.type === "foreach") {
                L.push(`# FOR-EACH: ${node.foreach.source} → ${node.foreach.itemVar}`);
                cur = this.edgeTarget(node.id, "body") || this.edgeTarget(node.id, "done");
            } else if (node.type === "checker") {
                L.push(`# CHECKER: curl -H "Authorization: Bearer $TOKEN" "https://prod-api.lzt.market/{item_id}"`);
                cur = this.edgeTarget(node.id, "ok") || this.edgeTarget(node.id, "fail");
            } else if (node.type === "sniper") {
                L.push(`# SNIPER: POST fast-buy для первого подходящего лота`);
                cur = this.edgeTarget(node.id, "bought") || this.edgeTarget(node.id, "skip");
            } else if (node.type === "subscenario") {
                L.push(`# ПОД-СЦЕНАРИЙ: вставьте вызов или source scenario.json`);
                cur = this.edgeTarget(node.id, "out");
            } else if (node.type === "stop") {
                cur = null;
            } else break;
        }
        L.push('echo "Сценарий завершён."');
        return L.join("\n");
    },

    // ---------- PHP (cURL) ----------
    generatePHP() {
        const { startTarget } = this.flow();
        const L = [];
        L.push("<?php");
        L.push('$TOKEN = "ВСТАВЬТЕ_ВАШ_ТОКЕН";');
        L.push('$context = ["last" => null, "vars" => []];');
        L.push('$counters = [];');
        L.push("");
        L.push("function get_path($obj, $path) {");
        L.push("    $cur = $obj;");
        L.push("    foreach (array_filter(array_map('trim', explode('.', $path))) as $p) {");
        L.push("        if ($cur === null) return null;");
        L.push("        if ($p === 'length' && is_array($cur)) { $cur = count($cur); continue; }");
        L.push("        if (is_array($cur)) { $cur = $cur[$p] ?? null; } else { return null; }");
        L.push("    }");
        L.push("    return $cur;");
        L.push("}");
        L.push("function resolve_val($val) {");
        L.push("    global $context;");
        L.push("    if (is_string($val)) return preg_replace_callback('/\\{\\{\\s*([^}]+)\\s*\\}\\}/', function($m){ global $context; $v = get_path($context, trim($m[1])); return $v === null ? '' : (is_array($v) ? json_encode($v) : strval($v)); }, $val);");
        L.push("    if (is_array($val)) { $o = []; foreach ($val as $k => $v) $o[$k] = resolve_val($v); return $o; }");
        L.push("    return $val;");
        L.push("}");
        L.push("function api_call($method, $url, $params, $body, $token) {");
        L.push("    if ($params) $url .= (strpos($url, '?') !== false ? '&' : '?') . http_build_query($params);");
        L.push("    $ch = curl_init($url);");
        L.push("    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);");
        L.push("    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);");
        L.push('    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $token"]);');
        L.push("    if ($body) curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($body));");
        L.push("    $resp = curl_exec($ch);");
        L.push("    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);");
        L.push("    curl_close($ch);");
        L.push('    return ["code" => $code, "data" => json_decode($resp, true)];');
        L.push("}");
        L.push("");
        L.push(`$node = ${startTarget ? this.py(startTarget) : "null"};`);
        L.push("$steps = 0;");
        L.push("while ($node !== null && $steps < 300) {");
        L.push("    $steps++;");
        this.nodes.forEach(node => {
            if (node.type === "start") return;
            L.push(`    if ($node === ${this.py(node.id)}) {`);
            if (node.type === "request") {
                const req = node.request || {};
                const succ = this.edgeTarget(node.id, "success");
                const err = this.edgeTarget(node.id, "error");
                L.push(`        $url = resolve_val(${this.py(req.url)});`);
                L.push(`        $params = resolve_val(${this.mapLiteral(req.params || {}, "php")});`);
                L.push(`        $body = ${req.body && Object.keys(req.body).length ? "resolve_val(" + this.mapLiteral(req.body, "php") + ")" : "null"};`);
                L.push(`        $r = api_call(${this.py(req.method || "GET")}, $url, $params, $body, $TOKEN);`);
                L.push(`        echo "[${req.method}] $url -> {$r['code']}\\n";`);
                L.push("        $context['last'] = $r['data'];");
                L.push(`        $node = $r['code'] < 400 ? ${succ ? this.py(succ) : "null"} : ${err ? this.py(err) : "null"};`);
            } else if (node.type === "condition") {
                const c = node.condition;
                const t = this.edgeTarget(node.id, "true");
                const f = this.edgeTarget(node.id, "false");
                L.push(`        $_l = get_path($context, ${this.py(c.left)});`);
                let expr;
                if (c.op === "exists") expr = "($_l !== null && $_l !== '')";
                else if (c.op === "==") expr = `(strval($_l) === ${this.py(c.right)})`;
                else if (c.op === "!=") expr = `(strval($_l) !== ${this.py(c.right)})`;
                else expr = `(floatval($_l) ${c.op} floatval(${this.py(c.right)}))`;
                L.push(`        $_ok = ${expr};`);
                L.push(`        $node = $_ok ? ${t ? this.py(t) : "null"} : ${f ? this.py(f) : "null"};`);
            } else if (node.type === "loop") {
                const b = this.edgeTarget(node.id, "body");
                const d = this.edgeTarget(node.id, "done");
                L.push(`        if (!isset($counters[${this.py(node.id)}])) $counters[${this.py(node.id)}] = 0;`);
                L.push(`        if ($counters[${this.py(node.id)}] < ${node.loop.times}) { $counters[${this.py(node.id)}]++; $node = ${b ? this.py(b) : "null"}; }`);
                L.push(`        else { $counters[${this.py(node.id)}] = 0; $node = ${d ? this.py(d) : "null"}; }`);
            } else if (node.type === "variable") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        $context['vars'][${this.py(node.variable.name)}] = get_path($context, ${this.py(node.variable.path)});`);
                L.push(`        $node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "logmsg") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        echo ${this.py(node.logmsg.text)} . "\\n";`);
                L.push(`        $node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "savefile") {
                const s = node.savefile;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        file_put_contents(${this.py(s.filename + "." + s.format)}, json_encode(get_path($context, ${this.py(s.source)}), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));`);
                L.push(`        $node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "notify") {
                const n = node.notify;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        // Уведомление (${n.channel}) — отправьте через curl/file_get_contents`);
                if (n.channel === "telegram" || n.channel === "both") L.push(`        @file_get_contents("https://api.telegram.org/bot${n.tgToken}/sendMessage?chat_id=${n.tgChat}&text=" . urlencode(${this.py(n.text)}));`);
                L.push(`        $node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "filter") {
                const found = this.edgeTarget(node.id, "found");
                const empty = this.edgeTarget(node.id, "empty");
                L.push(`        // ФИЛЬТР: ${node.filter.source} где ${node.filter.field} ${node.filter.op} ${node.filter.value}`);
                L.push(`        $node = ${found ? this.py(found) : "null"};`);
                void empty;
            } else if (node.type === "proxy") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        // ПРОКСИ: задайте CURLOPT_PROXY для запросов`);
                L.push(`        $node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "delay") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`        usleep(${(node.delay.ms || 0) * 1000});`);
                L.push(`        $node = ${nx ? this.py(nx) : "null"};`);
            } else if (this._cgExtNode(node, "php", "        ", L)) {
                /* extended */
            } else if (node.type === "stop") {
                L.push("        $node = null;");
            }
            L.push("        continue;");
            L.push("    }");
        });
        L.push("    $node = null;");
        L.push("}");
        L.push('echo "Сценарий завершён.\\n";');
        return L.join("\n");
    },

    // ---------- C# (HttpClient) ----------
    generateCSharp() {
        const { startTarget } = this.flow();
        const L = [];
        L.push("using System;");
        L.push("using System.Collections.Generic;");
        L.push("using System.Net.Http;");
        L.push("using System.Text.RegularExpressions;");
        L.push("using System.Threading;");
        L.push("using System.Threading.Tasks;");
        L.push("using System.Text.Json;");
        L.push("");
        L.push("class Scenario {");
        L.push('    static string TOKEN = "ВСТАВЬТЕ_ВАШ_ТОКЕН";');
        L.push("    static JsonElement? last = null;");
        L.push("    static readonly Dictionary<string,int> counters = new Dictionary<string,int>();");
        L.push("    static readonly Dictionary<string,string> vars = new Dictionary<string,string>();");
        L.push("    static readonly HttpClient http = new HttpClient();");
        L.push("");
        L.push("    static string Resolve(string val) {");
        L.push("        return Regex.Replace(val ?? \"\", @\"\\{\\{\\s*([^}]+)\\s*\\}\\}\", m => {");
        L.push("            var p = m.Groups[1].Value.Trim();");
        L.push("            if (p.StartsWith(\"vars.\")) return vars.TryGetValue(p.Substring(5), out var v) ? v : \"\";");
        L.push("            return GetPath(p);");
        L.push("        });");
        L.push("    }");
        L.push("    static string GetPath(string path) {");
        L.push("        if (last == null) return \"\";");
        L.push("        JsonElement cur = last.Value;");
        L.push("        foreach (var p in path.Split('.')) {");
        L.push("            var key = p.Trim(); if (key == \"\") continue;");
        L.push("            if (key == \"length\" && cur.ValueKind == JsonValueKind.Array) return cur.GetArrayLength().ToString();");
        L.push("            if (cur.ValueKind == JsonValueKind.Array && int.TryParse(key, out int i)) { cur = cur[i]; }");
        L.push("            else if (cur.ValueKind == JsonValueKind.Object && cur.TryGetProperty(key, out var nx)) { cur = nx; }");
        L.push("            else return \"\";");
        L.push("        }");
        L.push("        return cur.ToString();");
        L.push("    }");
        L.push("");
        L.push("    static async Task Main() {");
        L.push('        http.DefaultRequestHeaders.Add("Authorization", "Bearer " + TOKEN);');
        L.push(`        string node = ${startTarget ? this.py(startTarget) : "null"};`);
        L.push("        int steps = 0;");
        L.push("        while (node != null && steps < 300) {");
        L.push("            steps++;");
        this.nodes.forEach(node => {
            if (node.type === "start") return;
            L.push(`            if (node == ${this.py(node.id)}) {`);
            if (node.type === "request") {
                const req = node.request || {};
                const succ = this.edgeTarget(node.id, "success");
                const err = this.edgeTarget(node.id, "error");
                const qs = Object.entries(req.params || {}).map(([k, v]) => `${k}={Uri.EscapeDataString(Resolve(${this.py(String(Array.isArray(v) ? v.join(",") : v))}))}`).join("&");
                L.push(`                string url = Resolve(${this.py(req.url)})${qs ? ` + "?" + $"${qs}"` : ""};`);
                L.push(`                var reqMsg = new HttpRequestMessage(new HttpMethod(${this.py(req.method || "GET")}), url);`);
                if (req.body && Object.keys(req.body).length) {
                    const pairs = Object.entries(req.body).map(([k, v]) => `                    new KeyValuePair<string,string>(${this.py(k)}, Resolve(${this.py(String(v))})),`).join("\n");
                    L.push("                reqMsg.Content = new FormUrlEncodedContent(new[] {");
                    L.push(pairs);
                    L.push("                });");
                }
                L.push("                var resp = await http.SendAsync(reqMsg);");
                L.push("                var text = await resp.Content.ReadAsStringAsync();");
                L.push(`                Console.WriteLine($"[${req.method}] {url} -> {(int)resp.StatusCode}");`);
                L.push("                try { last = JsonSerializer.Deserialize<JsonElement>(text); } catch { last = null; }");
                L.push(`                node = resp.IsSuccessStatusCode ? ${succ ? this.py(succ) : "null"} : ${err ? this.py(err) : "null"};`);
            } else if (node.type === "condition") {
                const c = node.condition;
                const t = this.edgeTarget(node.id, "true");
                const f = this.edgeTarget(node.id, "false");
                L.push(`                string _l = GetPath(${this.py(c.left)});`);
                let expr;
                if (c.op === "exists") expr = '(_l != "")';
                else if (c.op === "==") expr = `(_l == ${this.py(c.right)})`;
                else if (c.op === "!=") expr = `(_l != ${this.py(c.right)})`;
                else expr = `(double.Parse(_l) ${c.op} double.Parse(${this.py(c.right)}))`;
                L.push(`                bool _ok; try { _ok = ${expr}; } catch { _ok = false; }`);
                L.push(`                node = _ok ? ${t ? this.py(t) : "null"} : ${f ? this.py(f) : "null"};`);
            } else if (node.type === "loop") {
                const b = this.edgeTarget(node.id, "body");
                const d = this.edgeTarget(node.id, "done");
                L.push(`                if (!counters.ContainsKey(${this.py(node.id)})) counters[${this.py(node.id)}] = 0;`);
                L.push(`                if (counters[${this.py(node.id)}] < ${node.loop.times}) { counters[${this.py(node.id)}]++; node = ${b ? this.py(b) : "null"}; }`);
                L.push(`                else { counters[${this.py(node.id)}] = 0; node = ${d ? this.py(d) : "null"}; }`);
            } else if (node.type === "variable") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                vars[${this.py(node.variable.name)}] = GetPath(${this.py(node.variable.path.replace(/^last\./, ""))});`);
                L.push(`                node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "logmsg") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                Console.WriteLine(${this.py(node.logmsg.text)});`);
                L.push(`                node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "savefile") {
                const s = node.savefile;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                // СОХРАНЕНИЕ: выгрузите ${s.source} в ${s.filename}.${s.format}`);
                L.push(`                node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "notify") {
                const n = node.notify;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                // Уведомление (${n.channel}) — отправьте через http.PostAsync`);
                if (n.channel === "telegram" || n.channel === "both") L.push(`                await http.GetAsync($"https://api.telegram.org/bot${n.tgToken}/sendMessage?chat_id=${n.tgChat}&text={Uri.EscapeDataString(${this.py(n.text)})}");`);
                L.push(`                node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "filter") {
                const found = this.edgeTarget(node.id, "found");
                L.push(`                // ФИЛЬТР: ${node.filter.source} где ${node.filter.field} ${node.filter.op} ${node.filter.value}`);
                L.push(`                node = ${found ? this.py(found) : "null"};`);
            } else if (node.type === "proxy") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                // ПРОКСИ: задайте HttpClientHandler.Proxy`);
                L.push(`                node = ${nx ? this.py(nx) : "null"};`);
            } else if (node.type === "delay") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`                Thread.Sleep(${node.delay.ms || 0});`);
                L.push(`                node = ${nx ? this.py(nx) : "null"};`);
            } else if (this._cgExtNode(node, "csharp", "                ", L)) {
                /* extended */
            } else if (node.type === "stop") {
                L.push("                node = null;");
            }
            L.push("                continue;");
            L.push("            }");
        });
        L.push("            node = null;");
        L.push("        }");
        L.push('        Console.WriteLine("Сценарий завершён.");');
        L.push("    }");
        L.push("}");
        return L.join("\n");
    },

    // ---------- Go (net/http) ----------
    generateGo() {
        const { startTarget } = this.flow();
        const L = [];
        L.push("package main");
        L.push("");
        L.push("import (");
        L.push('\t"encoding/json"');
        L.push('\t"fmt"');
        L.push('\t"io"');
        L.push('\t"net/http"');
        L.push('\t"net/url"');
        L.push('\t"strings"');
        L.push('\t"time"');
        L.push(")");
        L.push("");
        L.push('const TOKEN = "ВСТАВЬТЕ_ВАШ_ТОКЕН"');
        L.push("");
        L.push("func apiCall(method, u string, params, body map[string]string) (int, map[string]interface{}) {");
        L.push("\tif len(params) > 0 {");
        L.push("\t\tq := url.Values{}");
        L.push("\t\tfor k, v := range params { q.Set(k, v) }");
        L.push('\t\tif strings.Contains(u, "?") { u += "&" + q.Encode() } else { u += "?" + q.Encode() }');
        L.push("\t}");
        L.push("\tvar reqBody io.Reader");
        L.push("\tif len(body) > 0 {");
        L.push("\t\tf := url.Values{}");
        L.push("\t\tfor k, v := range body { f.Set(k, v) }");
        L.push("\t\treqBody = strings.NewReader(f.Encode())");
        L.push("\t}");
        L.push("\treq, _ := http.NewRequest(method, u, reqBody)");
        L.push('\treq.Header.Set("Authorization", "Bearer "+TOKEN)');
        L.push('\tif len(body) > 0 { req.Header.Set("Content-Type", "application/x-www-form-urlencoded") }');
        L.push("\tresp, err := http.DefaultClient.Do(req)");
        L.push("\tif err != nil { return 0, nil }");
        L.push("\tdefer resp.Body.Close()");
        L.push("\tb, _ := io.ReadAll(resp.Body)");
        L.push("\tvar data map[string]interface{}");
        L.push("\tjson.Unmarshal(b, &data)");
        L.push("\treturn resp.StatusCode, data");
        L.push("}");
        L.push("");
        L.push("func main() {");
        L.push(`\tnode := ${startTarget ? this.py(startTarget) : '""'}`);
        L.push("\tsteps := 0");
        L.push("\tcounters := map[string]int{}");
        L.push("\t_ = counters");
        L.push("\tfor node != \"\" && steps < 300 {");
        L.push("\t\tsteps++");
        L.push("\t\tswitch node {");
        this.nodes.forEach(node => {
            if (node.type === "start") return;
            L.push(`\t\tcase ${this.py(node.id)}:`);
            if (node.type === "request") {
                const req = node.request || {};
                const succ = this.edgeTarget(node.id, "success");
                const err = this.edgeTarget(node.id, "error");
                L.push(`\t\t\tparams := ${this.goMap(req.params || {})}`);
                L.push(`\t\t\tbody := ${req.body && Object.keys(req.body).length ? this.goMap(req.body) : "map[string]string{}"}`);
                L.push(`\t\t\tcode, data := apiCall(${this.py(req.method || "GET")}, ${this.py(req.url)}, params, body)`);
                L.push(`\t\t\tfmt.Printf("[${req.method}] %s -> %d\\n", ${this.py(req.url)}, code)`);
                L.push("\t\t\t_ = data");
                L.push(`\t\t\tif code < 400 { node = ${succ ? this.py(succ) : '""'} } else { node = ${err ? this.py(err) : '""'} }`);
            } else if (node.type === "condition") {
                const c = node.condition;
                const t = this.edgeTarget(node.id, "true");
                const f = this.edgeTarget(node.id, "false");
                L.push(`\t\t\t// Условие: ${this.pyComment(c.left + " " + c.op + " " + c.right)} — при необходимости уточните доступ к data`);
                L.push(`\t\t\tnode = ${t ? this.py(t) : '""'} // ветка «Да»; ветка «Нет»: ${f ? this.py(f) : '""'}`);
            } else if (node.type === "loop") {
                const b = this.edgeTarget(node.id, "body");
                const d = this.edgeTarget(node.id, "done");
                L.push(`\t\t\tif counters[${this.py(node.id)}] < ${node.loop.times} {`);
                L.push(`\t\t\t\tcounters[${this.py(node.id)}]++`);
                L.push(`\t\t\t\tnode = ${b ? this.py(b) : '""'}`);
                L.push("\t\t\t} else {");
                L.push(`\t\t\t\tcounters[${this.py(node.id)}] = 0`);
                L.push(`\t\t\t\tnode = ${d ? this.py(d) : '""'}`);
                L.push("\t\t\t}");
            } else if (node.type === "variable") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`\t\t\t// Переменная ${this.pyComment(node.variable.name + " = " + node.variable.path)} (доступ к data уточните вручную)`);
                L.push(`\t\t\tnode = ${nx ? this.py(nx) : '""'}`);
            } else if (node.type === "logmsg") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`\t\t\tfmt.Println(${this.py(node.logmsg.text)})`);
                L.push(`\t\t\tnode = ${nx ? this.py(nx) : '""'}`);
            } else if (node.type === "savefile") {
                const s = node.savefile;
                const nx = this.edgeTarget(node.id, "out");
                L.push(`\t\t\t// СОХРАНЕНИЕ: выгрузите ${s.source} в ${s.filename}.${s.format}`);
                L.push(`\t\t\tnode = ${nx ? this.py(nx) : '""'}`);
            } else if (node.type === "notify") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`\t\t\t// Уведомление (${node.notify.channel}) — отправьте через http.Post`);
                L.push(`\t\t\tnode = ${nx ? this.py(nx) : '""'}`);
            } else if (node.type === "filter") {
                const found = this.edgeTarget(node.id, "found");
                L.push(`\t\t\t// ФИЛЬТР: ${node.filter.source} где ${node.filter.field} ${node.filter.op} ${node.filter.value}`);
                L.push(`\t\t\tnode = ${found ? this.py(found) : '""'}`);
            } else if (node.type === "proxy") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`\t\t\t// ПРОКСИ: задайте http.Transport.Proxy`);
                L.push(`\t\t\tnode = ${nx ? this.py(nx) : '""'}`);
            } else if (node.type === "delay") {
                const nx = this.edgeTarget(node.id, "out");
                L.push(`\t\t\ttime.Sleep(${node.delay.ms || 0} * time.Millisecond)`);
                L.push(`\t\t\tnode = ${nx ? this.py(nx) : '""'}`);
            } else if (this._cgExtNode(node, "go", "\t\t\t", L)) {
                /* extended */
            } else if (node.type === "stop") {
                L.push('\t\t\tnode = ""');
            }
        });
        L.push("\t\tdefault:");
        L.push('\t\t\tnode = ""');
        L.push("\t\t}");
        L.push("\t}");
        L.push('\tfmt.Println("Сценарий завершён.")');
        L.push("}");
        return L.join("\n");
    },

    goMap(obj) {
        const entries = Object.entries(obj);
        if (!entries.length) return "map[string]string{}";
        return "map[string]string{" + entries.map(([k, v]) => `${this.py(k)}: ${this.py(String(Array.isArray(v) ? v.join(",") : v))}`).join(", ") + "}";
    },

    _globalErrTarget() {
        const start = this.nodes.find(n => n.type === "start");
        if (!start || (start.start && start.start.globalError === false)) return null;
        return this.edgeTarget(start.id, "onerror");
    },

    _errNext(nodeId, errPort) {
        const err = this.edgeTarget(nodeId, errPort);
        if (err) return this.py(err);
        const ge = this._globalErrTarget();
        return ge ? this.py(ge) : "None";
    },

    _errNextJs(nodeId, errPort) {
        const err = this.edgeTarget(nodeId, errPort);
        if (err) return this.py(err);
        const ge = this._globalErrTarget();
        return ge ? this.py(ge) : "null";
    },

    // Расширенные блоки: foreach, checker, sniper, subscenario (все языки)
    _cgExtNode(node, lang, pad, L) {
        const I = pad;
        const et = (p) => this.edgeTarget(node.id, p);
        const py = (s) => this.py(s);

        if (node.type === "foreach") {
            const fe = node.foreach;
            const body = et("body"), done = et("done");
            if (lang === "py") {
                L.push(`${I}_arr = get_path(context, ${py(fe.source)})`);
                L.push(`${I}_ki = ${py(node.id + "_fi")}`);
                L.push(`${I}counters[_ki] = counters.get(_ki, 0)`);
                L.push(`${I}if not isinstance(_arr, list):`);
                L.push(`${I}    node = ${done ? py(done) : "None"}`);
                L.push(`${I}elif counters[_ki] >= len(_arr):`);
                L.push(`${I}    counters[_ki] = 0; node = ${done ? py(done) : "None"}`);
                L.push(`${I}else:`);
                L.push(`${I}    _it = _arr[counters[_ki]]; counters[_ki] += 1`);
                L.push(`${I}    context['vars'][${py(fe.itemVar)}] = _it`);
                L.push(`${I}    context['vars'][${py(fe.indexVar || "i")}] = counters[_ki] - 1`);
                L.push(`${I}    context['last'] = _it; node = ${body ? py(body) : "None"}`);
            } else if (lang === "pyasync") {
                L.push(`${I}_arr = get_path(context, ${py(fe.source)})`);
                L.push(`${I}_ki = ${py(node.id + "_fi")}`);
                L.push(`${I}counters[_ki] = counters.get(_ki, 0)`);
                L.push(`${I}if not isinstance(_arr, list):`);
                L.push(`${I}    node = ${done ? py(done) : "None"}`);
                L.push(`${I}elif counters[_ki] >= len(_arr):`);
                L.push(`${I}    counters[_ki] = 0; node = ${done ? py(done) : "None"}`);
                L.push(`${I}else:`);
                L.push(`${I}    _it = _arr[counters[_ki]]; counters[_ki] += 1`);
                L.push(`${I}    context['vars'][${py(fe.itemVar)}] = _it`);
                L.push(`${I}    context['vars'][${py(fe.indexVar || "i")}] = counters[_ki] - 1`);
                L.push(`${I}    context['last'] = _it; node = ${body ? py(body) : "None"}`);
            } else if (lang === "node") {
                L.push(`${I}const _arr = getPath(context, ${py(fe.source)});`);
                L.push(`${I}const _ki = ${py(node.id + "_fi")}; counters[_ki] = counters[_ki] || 0;`);
                L.push(`${I}if (!Array.isArray(_arr)) node = ${done ? py(done) : "null"};`);
                L.push(`${I}else if (counters[_ki] >= _arr.length) { counters[_ki] = 0; node = ${done ? py(done) : "null"}; }`);
                L.push(`${I}else { context.vars[${py(fe.itemVar)}] = _arr[counters[_ki]]; context.vars[${py(fe.indexVar || "i")}] = counters[_ki]; context.last = _arr[counters[_ki]]; counters[_ki]++; node = ${body ? py(body) : "null"}; }`);
            } else if (lang === "bash") {
                L.push(`${I}# For-each: ${fe.source} → ${fe.itemVar}`);
                L.push(`${I}node=${body ? py(body) : "None"}  # упр. — доработайте цикл вручную`);
            } else if (lang === "php") {
                L.push(`${I}$arr = get_path($context, ${py(fe.source)}); $ki = ${py(node.id + "_fi")};`);
                L.push(`${I}if (!is_array($arr) || $counters[$ki] >= count($arr)) { $counters[$ki]=0; $node=${done ? py(done) : "null"}; }`);
                L.push(`${I}else { $context['vars'][${py(fe.itemVar)}]=$arr[$counters[$ki]]; $context['last']=$arr[$counters[$ki]]; $counters[$ki]++; $node=${body ? py(body) : "null"}; }`);
            } else if (lang === "csharp") {
                L.push(`${I}// For-each ${fe.source}`);
                L.push(`${I}node = ${body ? py(body) : '""'};`);
            } else if (lang === "go") {
                L.push(`${I}// For-each ${fe.source}`);
                L.push(`${I}node = ${body ? py(body) : '""'}`);
            }
            return true;
        }

        if (node.type === "checker") {
            const c = node.checker;
            const okP = et("ok"), failP = et("fail");
            if (lang === "py") {
                L.push(`${I}_id = get_path(context, ${py(c.itemPath)})`);
                L.push(`${I}if _id is None: _id = resolve(${py(c.itemPath)})`);
                L.push(`${I}_r = do_request("GET", "https://prod-api.lzt.market/" + str(_id))`);
                L.push(`${I}try: _j = _r.json() if _r.ok else {}`);
                L.push(`${I}except: _j = {}`);
                L.push(`${I}_item = _j.get('item', _j) if isinstance(_j, dict) else {}`);
                L.push(`${I}_sold = _item.get('item_state') in ('paid','deleted') or _item.get('is_sold')`);
                L.push(`${I}_ok = bool(_item.get('item_id')) and (not _sold if ${c.rejectSold !== false ? "True" : "False"} else True)`);
                L.push(`${I}node = ${okP ? py(okP) : "None"} if _ok else ${failP ? py(failP) : "None"}`);
            } else if (lang === "pyasync") {
                L.push(`${I}_id = get_path(context, ${py(c.itemPath)}) or resolve(${py(c.itemPath)})`);
                L.push(`${I}async with session.get(f"https://prod-api.lzt.market/{_id}", proxy=cur_proxy()) as _r:`);
                L.push(`${I}    try: _j = await _r.json(content_type=None) if _r.status < 400 else {}`);
                L.push(`${I}    except: _j = {}`);
                L.push(`${I}    _item = _j.get('item', _j) if isinstance(_j, dict) else {}`);
                L.push(`${I}    _sold = _item.get('item_state') in ('paid','deleted') or _item.get('is_sold')`);
                L.push(`${I}    _ok = bool(_item.get('item_id')) and (not _sold if ${c.rejectSold !== false ? "True" : "False"} else True)`);
                L.push(`${I}node = ${okP ? py(okP) : "None"} if _ok else ${failP ? py(failP) : "None"}`);
            } else if (lang === "node") {
                L.push(`${I}try {`);
                L.push(`${I}  const _id = getPath(context, ${py(c.itemPath)}) ?? resolve(${py(c.itemPath)});`);
                L.push(`${I}  const _r = await axios.get(\`https://prod-api.lzt.market/\${_id}\`, { headers: HEADERS });`);
                L.push(`${I}  const _item = _r.data.item || _r.data; const _sold = _item.item_state === 'paid' || _item.is_sold;`);
                L.push(`${I}  const _ok = !!_item.item_id && ${c.rejectSold !== false ? "!_sold" : "true"};`);
                L.push(`${I}  node = _ok ? ${okP ? py(okP) : "null"} : ${failP ? py(failP) : "null"};`);
                L.push(`${I}} catch (e) { node = ${failP ? py(failP) : "null"}; }`);
            } else {
                L.push(`${I}# Checker: GET /{item_id}`);
                L.push(`${I}node = ${okP ? py(okP) : (lang === "go" ? '""' : "None")};`);
            }
            return true;
        }

        if (node.type === "sniper") {
            const sn = node.sniper;
            const bought = et("bought"), skip = et("skip");
            if (lang === "py") {
                L.push(`${I}context['vars'].setdefault('_lzt_spend', 0)`);
                L.push(`${I}_items = get_path(context, ${py(sn.source)}) or []`);
                L.push(`${I}_maxp = float(resolve(${py(String(sn.maxPrice))}) or 1e18)`);
                L.push(`${I}_maxs = float(resolve(${py(String(sn.maxSpend))}) or 1e18)`);
                L.push(`${I}node = ${skip ? py(skip) : "None"}; _bought = False`);
                L.push(`${I}for _it in (_items if isinstance(_items, list) else []):`);
                L.push(`${I}    _price = float(_it.get(${py(sn.priceField || "price")}, 0) or 0)`);
                L.push(`${I}    _iid = _it.get(${py(sn.itemField || "item_id")})`);
                L.push(`${I}    if not _iid or _price > _maxp or context['vars']['_lzt_spend'] + _price > _maxs: continue`);
                L.push(`${I}    _br = do_request('POST', f"https://prod-api.lzt.market/{_iid}/fast-buy")`);
                L.push(`${I}    if _br.ok: context['vars']['_lzt_spend'] += _price; node = ${bought ? py(bought) : "None"}; _bought = True; break`);
            } else if (lang === "pyasync") {
                L.push(`${I}context['vars'].setdefault('_lzt_spend', 0)`);
                L.push(`${I}_items = get_path(context, ${py(sn.source)}) or []`);
                L.push(`${I}_maxp = float(resolve(${py(String(sn.maxPrice))}) or 1e18)`);
                L.push(`${I}_maxs = float(resolve(${py(String(sn.maxSpend))}) or 1e18)`);
                L.push(`${I}node = ${skip ? py(skip) : "None"}; _bought = False`);
                L.push(`${I}for _it in (_items if isinstance(_items, list) else []):`);
                L.push(`${I}    _price = float(_it.get(${py(sn.priceField || "price")}, 0) or 0)`);
                L.push(`${I}    _iid = _it.get(${py(sn.itemField || "item_id")})`);
                L.push(`${I}    if not _iid or _price > _maxp or context['vars']['_lzt_spend'] + _price > _maxs: continue`);
                L.push(`${I}    async with session.post(f"https://prod-api.lzt.market/{_iid}/fast-buy", proxy=cur_proxy()) as _br:`);
                L.push(`${I}        if _br.status < 400: context['vars']['_lzt_spend'] += _price; node = ${bought ? py(bought) : "None"}; _bought = True; break`);
            } else if (lang === "node") {
                L.push(`${I}context.vars._lzt_spend = context.vars._lzt_spend || 0;`);
                L.push(`${I}const _items = getPath(context, ${py(sn.source)}) || []; let _b = false;`);
                L.push(`${I}for (const _it of _items) {`);
                L.push(`${I}  const _p = parseFloat(_it[${py(sn.priceField || "price")}] || 0);`);
                L.push(`${I}  const _id = _it[${py(sn.itemField || "item_id")}];`);
                L.push(`${I}  if (!_id || _p > parseFloat(${py(String(sn.maxPrice))})) continue;`);
                L.push(`${I}  try { await axios.post(\`https://prod-api.lzt.market/\${_id}/fast-buy\`, {}, { headers: HEADERS }); context.vars._lzt_spend += _p; node = ${bought ? py(bought) : "null"}; _b = true; break; } catch(e) {}`);
                L.push(`${I}}`);
                L.push(`${I}if (!_b) node = ${skip ? py(skip) : "null"};`);
            } else {
                L.push(`${I}# Sniper: fast-buy first match`);
                L.push(`${I}node = ${skip ? py(skip) : (lang === "go" ? '""' : "None")};`);
            }
            return true;
        }

        if (node.type === "subscenario") {
            const nx = et("out");
            const ss = node.subscenario;
            L.push(`${I}# Под-сценарий (templateId: ${ss.templateId || "?"}) — вставьте JSON или вызовите функцию`);
            if (lang === "node") L.push(`${I}node = ${nx ? py(nx) : "null"};`);
            else if (lang === "go") L.push(`${I}node = ${nx ? py(nx) : '""'}`);
            else L.push(`${I}node = ${nx ? py(nx) : "None"}`);
            return true;
        }
        return false;
    },

    /** requirements.txt для ZIP-экспорта — зависимости по блокам сценария */
    buildProjectRequirements(data) {
        data = data || {};
        const nodes = data.nodes || this.nodes || [];
        const lines = ["requests>=2.31.0"];
        const notes = [];

        const notifyNodes = nodes.filter(n => n.type === "notify" && n.notify);
        if (notifyNodes.length) {
            const channels = new Set();
            notifyNodes.forEach(n => {
                const c = n.notify.channel || "telegram";
                if (c === "both") {
                    channels.add("telegram");
                    channels.add("discord");
                } else {
                    channels.add(c);
                }
            });
            notes.push("");
            notes.push("# Уведомления — HTTP через requests (отдельные python-telegram-bot / discord.py не нужны):");
            if (channels.has("telegram")) {
                notes.push("#   Telegram: Bot API POST …/bot<TOKEN>/sendMessage (chat_id + text)");
            }
            if (channels.has("discord")) {
                notes.push("#   Discord: webhook URL POST {\"content\": \"…\"}");
            }
        }

        if (nodes.some(n => n.type === "proxy" && String(n.proxy?.list || "").trim())) {
            notes.push("# Прокси SOCKS: pip install \"requests[socks]\" при необходимости");
        }

        if (nodes.some(n => n.type === "savefile")) {
            notes.push("# CSV/JSON: стандартная библиотека Python (csv, json)");
        }

        return lines.concat(notes).join("\n") + "\n";
    },

    /** README.md для ZIP-экспорта */
    buildProjectReadme(title, data) {
        data = data || {};
        const nodes = data.nodes || this.nodes || [];
        const t = title || data.title || "LZT бот";
        let extra = "";

        const notifyNodes = nodes.filter(n => n.type === "notify" && n.notify);
        if (notifyNodes.length) {
            extra += "\n## Уведомления\n\n";
            extra += "В сценарии есть блок «Уведомление». В `bot.py` используется **requests** (Telegram Bot API и Discord webhook), без отдельных библиотек.\n\n";
            extra += "Перед запуском впишите в блоке уведомления в конструкторе (или в `scenario.json`):\n";
            const needTg = notifyNodes.some(n => n.notify.channel === "telegram" || n.notify.channel === "both");
            const needDc = notifyNodes.some(n => n.notify.channel === "discord" || n.notify.channel === "both");
            if (needTg) extra += "- **Telegram:** `tgToken` (от @BotFather) и `tgChat` (ваш chat_id)\n";
            if (needDc) extra += "- **Discord:** `discordUrl` (URL webhook из настроек канала)\n";
        }

        return `# ${t}

Сгенерировано **LZT API Constructor**.

## Запуск

\`\`\`bash
pip install -r requirements.txt
python bot.py
\`\`\`

> Впишите свой API-токен LOLZTEAM в переменную \`TOKEN\` в начале \`bot.py\`.
${extra}
Файл \`scenario.json\` — исходный сценарий, его можно снова открыть в конструкторе.
`;
    },
    });
})();
