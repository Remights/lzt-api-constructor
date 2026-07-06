/** Popover-редакторы: старт, условие, задержка, цикл, переменная. */
(function () {
    "use strict";
    const R = () => window.ScenarioPropEditorRegistry;
    if (!R()) return;

    R().register("start", ({ sc, node, pop, dismiss, esc }) => {
        pop.classList.add("pop-wide");
        const token = (window.LZTToken && window.LZTToken.get()) || "";
        const st = node.start || { globalError: true };
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-key" style="color:#8e8e93;"></i> Старт — токен и ошибки</div>
            <div class="pop-intro">Bearer-токен Lolzteam для реальных запросов. Не попадает в экспорт сценария.</div>
            <button type="button" class="btn-get-token-pop" id="pop-get-token"><i class="fa-solid fa-arrow-up-right-from-square"></i> Где взять токен?</button>
            <label class="pop-label" style="margin-top:12px;">API Токен (Bearer)</label>
            <div class="pop-field-row">
                <input type="password" class="form-control" id="pop-token" value="${esc(token)}" placeholder="Вставьте токен…">
                <button type="button" class="btn-pick-field" id="pop-token-eye" title="Показать/скрыть"><i class="fa-solid fa-eye"></i></button>
            </div>
            <label class="rate-check" style="margin-top:12px;"><input type="checkbox" id="pop-global-err" ${st.globalError !== false ? "checked" : ""}> Глобальная обработка ошибок — если у запроса не подключён выход «Ошибка», идти по линии «Ошибка» от Старта</label>
            <div class="pop-sync"><button type="button" id="pop-sync" class="pop-sync-btn"><i class="fa-solid fa-rotate"></i> Обновить базу API</button><span id="pop-sync-status" class="pop-sync-status"></span></div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Сохранить</button></div>`;
        document.body.appendChild(pop);
        const tokenInput = pop.querySelector("#pop-token");
        pop.querySelector("#pop-get-token").addEventListener("click", () => window.LZTToken && window.LZTToken.openGetPage());
        pop.querySelector("#pop-token-eye").addEventListener("click", () => {
            tokenInput.type = tokenInput.type === "password" ? "text" : "password";
        });
        pop.querySelector("#pop-sync").addEventListener("click", async () => {
            const stEl = pop.querySelector("#pop-sync-status");
            stEl.textContent = "синхронизация…";
            try {
                const r = window.LZTSyncSpec ? await window.LZTSyncSpec() : { ok: false };
                stEl.textContent = r.ok ? `обновлено (${r.count})` : "ошибка";
            } catch (e) { stEl.textContent = "ошибка сети"; }
        });
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            if (window.LZTToken) window.LZTToken.set(tokenInput.value);
            node.start = node.start || {};
            node.start.globalError = pop.querySelector("#pop-global-err").checked;
            dismiss();
            sc.refreshStartNode();
            sc.commit();
        });
    });

    R().register("condition", ({ sc, node, pop, dismiss, esc, OP_LABELS }) => {
        const c = node.condition;
        const ops = Object.keys(OP_LABELS).map(o => `<option value="${o}" ${c.op === o ? "selected" : ""}>${o === "exists" ? "существует" : o + " (" + OP_LABELS[o] + ")"}</option>`).join("");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-code-branch" style="color:#e6a23c;"></i> Условие</div>
            <label class="pop-label">Поле из ответа предыдущего блока</label>
            <input type="text" class="form-control" id="pop-left" value="${esc(c.left)}" placeholder="last.items.length">
            <label class="pop-label" style="margin-top:8px;">Оператор</label>
            <select class="form-control" id="pop-op">${ops}</select>
            <label class="pop-label" id="pop-right-label" style="margin-top:8px;">Значение для сравнения</label>
            <input type="text" class="form-control" id="pop-right" value="${esc(c.right)}" placeholder="0">
            <div class="pop-hint">Напр. <code>last.items.length</code> больше <code>0</code> — есть ли лоты в ответе.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        const rightWrap = pop.querySelector("#pop-right");
        const rightLbl = pop.querySelector("#pop-right-label");
        const syncRight = () => {
            const hide = pop.querySelector("#pop-op").value === "exists";
            rightWrap.style.display = hide ? "none" : "block";
            rightLbl.style.display = hide ? "none" : "block";
        };
        pop.querySelector("#pop-op").addEventListener("change", syncRight);
        syncRight();
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            c.left = pop.querySelector("#pop-left").value.trim() || "last";
            c.op = pop.querySelector("#pop-op").value;
            c.right = pop.querySelector("#pop-right").value.trim();
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("delay", ({ sc, node, pop, dismiss }) => {
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-clock" style="color:#3594bc;"></i> Задержка</div>
            <label class="pop-label">Пауза, миллисекунд</label>
            <input type="number" class="form-control" id="pop-ms" value="${node.delay.ms}" min="0" step="100">
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            node.delay.ms = parseInt(pop.querySelector("#pop-ms").value, 10) || 0;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("loop", ({ sc, node, pop, dismiss }) => {
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-rotate-right" style="color:#9b59b6;"></i> Цикл</div>
            <label class="pop-label">Сколько раз повторить</label>
            <input type="number" class="form-control" id="pop-times" value="${node.loop.times}" min="1" step="1">
            <div class="pop-hint">Выход <b>«Тело»</b> выполнится указанное число раз (подключите его обратно к циклу), затем управление уйдёт в <b>«Готово»</b>.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            node.loop.times = Math.max(1, parseInt(pop.querySelector("#pop-times").value, 10) || 1);
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("variable", ({ sc, node, pop, dismiss, esc }) => {
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-box-archive" style="color:#16a085;"></i> Запомнить значение</div>
            <div class="pop-intro">Этот блок берёт одно значение из ответа предыдущего запроса и сохраняет его под понятным именем — чтобы потом подставить в другие блоки.</div>
            <label class="pop-label"><span class="pop-step">1</span> Что запомнить из ответа?</label>
            <div class="pop-field-row">
                <input type="text" class="form-control" id="pop-path" value="${esc(node.variable.path)}" placeholder="last.items.0.item_id">
                <button type="button" class="btn-pick-field" id="pop-pick"><i class="fa-solid fa-wand-magic-sparkles"></i> Выбрать</button>
            </div>
            <div id="pop-field-list" class="pop-field-list" style="display:none;"></div>
            <label class="pop-label" style="margin-top:12px;"><span class="pop-step">2</span> Как назвать это значение?</label>
            <input type="text" class="form-control" id="pop-name" value="${esc(node.variable.name)}" placeholder="item_id">
            <div class="pop-usage">Готово! Теперь пишите <code id="pop-usage-code">{{vars.${esc(node.variable.name)}}}</code> в URL или параметрах любого блока.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Сохранить</button></div>`;
        document.body.appendChild(pop);

        const nameInput = pop.querySelector("#pop-name");
        const pathInput = pop.querySelector("#pop-path");
        const usageCode = pop.querySelector("#pop-usage-code");
        const syncUsage = () => {
            const nm = (nameInput.value.trim().replace(/[^\w]/g, "_")) || "my_var";
            usageCode.textContent = `{{vars.${nm}}}`;
        };
        nameInput.addEventListener("input", syncUsage);

        const listBox = pop.querySelector("#pop-field-list");
        pop.querySelector("#pop-pick").addEventListener("click", () => {
            if (listBox.style.display === "block") { listBox.style.display = "none"; return; }
            sc.editingNodeId = node.id;
            const sample = sc.sampleForEditing();
            listBox.innerHTML = "";
            if (!sample) {
                listBox.innerHTML = `<div class="pop-field-empty">Нет данных для выбора. Сначала <b>запустите сценарий</b> или проверьте предыдущий запрос — тогда здесь появятся поля из ответа. А пока можно вписать путь вручную.</div>`;
                listBox.style.display = "block";
                return;
            }
            const paths = sc.flattenPaths(sample, "", [], 0);
            const search = document.createElement("input");
            search.type = "text";
            search.className = "form-control";
            search.placeholder = "Поиск поля…";
            search.style.cssText = "margin-bottom:6px;";
            listBox.appendChild(search);
            const rows = document.createElement("div");
            rows.className = "pop-field-rows";
            listBox.appendChild(rows);
            const draw = (q) => {
                rows.innerHTML = "";
                paths.filter(p => !q || p.path.toLowerCase().includes(q)).slice(0, 80).forEach(p => {
                    const it = document.createElement("div");
                    it.className = "pop-field-item";
                    const preview = p.val === null ? "null" : String(p.val);
                    it.innerHTML = `<code>last.${esc(p.path)}</code><span class="pop-field-preview">${esc(preview.slice(0, 40))}</span>`;
                    it.addEventListener("click", () => {
                        pathInput.value = `last.${p.path}`;
                        if (!nameInput.value.trim()) {
                            const parts = p.path.split(".").filter(x => !/^\d+$/.test(x));
                            nameInput.value = (parts[parts.length - 1] || "value").replace(/[^\w]/g, "_");
                            syncUsage();
                        }
                        listBox.style.display = "none";
                    });
                    rows.appendChild(it);
                });
                if (!rows.children.length) rows.innerHTML = `<div class="pop-field-empty">Ничего не найдено</div>`;
            };
            search.addEventListener("input", () => draw(search.value.trim().toLowerCase()));
            draw("");
            listBox.style.display = "block";
            setTimeout(() => search.focus(), 30);
        });

        pop.querySelector("#pop-ok").addEventListener("click", () => {
            node.variable.name = nameInput.value.trim().replace(/[^\w]/g, "_") || "my_var";
            node.variable.path = pathInput.value.trim() || "last";
            sc.editingNodeId = null;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });
})();
