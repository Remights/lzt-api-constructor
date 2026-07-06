/** Popover-редакторы: уведомление, лог, файл, прокси. */
(function () {
    "use strict";
    const R = () => window.ScenarioPropEditorRegistry;
    if (!R()) return;

    R().register("logmsg", ({ sc, node, pop, dismiss, esc }) => {
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-comment-dots" style="color:#7f8c8d;"></i> Сообщение в лог</div>
            <label class="pop-label">Текст сообщения</label>
            <textarea class="form-control" id="pop-text" rows="3" placeholder="Найдено {{last.items.length}} лотов">${esc(node.logmsg.text)}</textarea>
            <div class="pop-hint">Можно вставлять данные из ответа: <code>{{last.items.length}}</code>, <code>{{vars.item_id}}</code>.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            node.logmsg.text = pop.querySelector("#pop-text").value;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("savefile", ({ sc, node, pop, dismiss, esc }) => {
        const s = node.savefile;
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-file-arrow-down" style="color:#27ae60;"></i> Сохранить в файл</div>
            <div class="pop-intro">Выгружает данные из ответа в файл. Список объектов удобно сохранять в CSV (откроется в Excel), любые данные — в JSON.</div>
            <label class="pop-label">Что сохранить (путь в ответе)</label>
            <input type="text" class="form-control" id="pop-source" value="${esc(s.source)}" placeholder="last.items или vars.filtered">
            <label class="pop-label" style="margin-top:10px;">Формат файла</label>
            <select class="form-control" id="pop-format">
                <option value="csv" ${s.format === "csv" ? "selected" : ""}>CSV (таблица для Excel)</option>
                <option value="json" ${s.format === "json" ? "selected" : ""}>JSON</option>
            </select>
            <label class="pop-label" style="margin-top:10px;">Имя файла (без расширения)</label>
            <input type="text" class="form-control" id="pop-filename" value="${esc(s.filename)}" placeholder="results">
            <div class="pop-hint">Файл скачается при выполнении сценария. Источник — список объектов, напр. <code>last.items</code> или <code>vars.filtered</code>.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            s.source = pop.querySelector("#pop-source").value.trim() || "last.items";
            s.format = pop.querySelector("#pop-format").value;
            s.filename = (pop.querySelector("#pop-filename").value.trim() || "results").replace(/[^\w\-]+/g, "_");
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("proxy", ({ sc, node, pop, dismiss, esc }) => {
        const p = node.proxy;
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-shield-halved" style="color:#607d8b;"></i> Прокси</div>
            <div class="pop-intro">Все запросы после этого блока пойдут через прокси. По одному на строку.</div>
            <label class="pop-label">Список прокси</label>
            <textarea class="form-control" id="pop-list" rows="4" placeholder="host:port&#10;host:port:user:pass&#10;http://user:pass@host:port">${esc(p.list)}</textarea>
            <label class="pop-label" style="margin-top:10px;">Как выбирать</label>
            <select class="form-control" id="pop-mode">
                <option value="rotate" ${p.mode === "rotate" ? "selected" : ""}>По очереди (ротация)</option>
                <option value="random" ${p.mode === "random" ? "selected" : ""}>Случайно</option>
            </select>
            <div class="pop-hint">Форматы: <code>host:port</code>, <code>host:port:логин:пароль</code> или <code>схема://...</code></div>
            <div id="pop-proxy-check" style="margin-top:8px;"></div>
            <div class="pop-actions"><button class="btn-token" id="pop-check"><i class="fa-solid fa-magnifying-glass"></i> Проверить</button><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-check").addEventListener("click", async () => {
            const list = pop.querySelector("#pop-list").value.split("\n").map(s => s.trim()).filter(Boolean);
            const box = pop.querySelector("#pop-proxy-check");
            if (!list.length) { box.innerHTML = '<span style="color:#e6a23c;font-size:12px;">Список пуст</span>'; return; }
            box.innerHTML = '<span style="font-size:12px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Проверяю ' + list.length + '…</span>';
            try {
                const res = await fetch("/api/check-proxies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proxies: list }) });
                const d = await res.json();
                if (!d.success) { box.innerHTML = '<span style="color:#ff5555;font-size:12px;">' + esc(d.error || "Ошибка") + '</span>'; return; }
                const rows = d.results.map(r => {
                    const ic = r.alive ? '<span style="color:#27ae60;">●</span>' : '<span style="color:#ff5555;">●</span>';
                    const info = r.alive ? `${r.ms}мс${r.ip ? " · " + esc(r.ip) : ""}` : esc(r.error || ("HTTP " + (r.status || "?")));
                    return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:2px 0;"><span>${ic} ${esc(r.proxy)}</span><span style="color:var(--text-muted);">${info}</span></div>`;
                }).join("");
                box.innerHTML = `<div style="font-size:12px;margin-bottom:4px;">Живых: <b style="color:#27ae60;">${d.alive}</b> / ${d.total} <button class="pop-inline-link" id="pop-keep-alive" style="float:right;">Оставить только живые</button></div><div style="max-height:140px;overflow:auto;background:var(--bg-input);border-radius:6px;padding:6px;">${rows}</div>`;
                const keep = box.querySelector("#pop-keep-alive");
                if (keep) keep.addEventListener("click", () => {
                    pop.querySelector("#pop-list").value = d.results.filter(r => r.alive).map(r => r.proxy).join("\n");
                });
            } catch (e) {
                box.innerHTML = '<span style="color:#ff5555;font-size:12px;">' + esc(String(e)) + '</span>';
            }
        });
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            p.list = pop.querySelector("#pop-list").value;
            p.mode = pop.querySelector("#pop-mode").value;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("notify", ({ sc, node, pop, dismiss, esc }) => {
        const n = node.notify;
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-paper-plane" style="color:#0088cc;"></i> Уведомление</div>
            <div class="pop-intro">Отправит вам сообщение, когда сценарий дойдёт до этого блока. Удобно для «сообщи, когда нашёл дешёвый аккаунт».</div>
            <label class="pop-label">Куда отправлять</label>
            <select class="form-control" id="pop-channel">
                <option value="telegram" ${n.channel === "telegram" ? "selected" : ""}>Telegram</option>
                <option value="discord" ${n.channel === "discord" ? "selected" : ""}>Discord</option>
                <option value="both" ${n.channel === "both" ? "selected" : ""}>Telegram + Discord</option>
            </select>
            <div id="pop-tg-fields">
                <label class="pop-label" style="margin-top:10px;">Токен Telegram-бота <a href="#" id="pop-tg-help" class="pop-inline-link">(как получить?)</a></label>
                <input type="text" class="form-control" id="pop-tgtoken" value="${esc(n.tgToken)}" placeholder="123456:ABC-DEF...">
                <label class="pop-label" style="margin-top:8px;">Ваш chat_id</label>
                <input type="text" class="form-control" id="pop-tgchat" value="${esc(n.tgChat)}" placeholder="напр. 123456789">
            </div>
            <div id="pop-dc-fields">
                <label class="pop-label" style="margin-top:10px;">Discord Webhook URL</label>
                <input type="text" class="form-control" id="pop-dcurl" value="${esc(n.discordUrl)}" placeholder="https://discord.com/api/webhooks/...">
            </div>
            <label class="pop-label" style="margin-top:10px;">Текст сообщения</label>
            <textarea class="form-control" id="pop-text" rows="2" placeholder="Найдено {{last.items.length}} лотов!">${esc(n.text)}</textarea>
            <div class="pop-hint">Можно вставлять <code>{{last...}}</code> и <code>{{vars...}}</code>.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        const chSel = pop.querySelector("#pop-channel");
        const tgF = pop.querySelector("#pop-tg-fields");
        const dcF = pop.querySelector("#pop-dc-fields");
        const syncCh = () => {
            const c = chSel.value;
            tgF.style.display = (c === "telegram" || c === "both") ? "block" : "none";
            dcF.style.display = (c === "discord" || c === "both") ? "block" : "none";
        };
        chSel.addEventListener("change", syncCh);
        syncCh();
        pop.querySelector("#pop-tg-help").addEventListener("click", (e) => {
            e.preventDefault();
            fetch("/api/open-browser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://t.me/BotFather" }) });
        });
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            n.channel = chSel.value;
            n.tgToken = pop.querySelector("#pop-tgtoken").value.trim();
            n.tgChat = pop.querySelector("#pop-tgchat").value.trim();
            n.discordUrl = pop.querySelector("#pop-dcurl").value.trim();
            n.text = pop.querySelector("#pop-text").value;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });
})();
