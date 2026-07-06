/** Popover-редакторы: запрос, фильтр. */
(function () {
    "use strict";
    const R = () => window.ScenarioPropEditorRegistry;
    if (!R()) return;

    R().register("request", ({ sc, node, pop, dismiss, esc }) => {
        const req = node.request || {};
        const paramsText = sc._reqParamsToText(req.params);
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-bolt" style="color:#00ba78;"></i> Запрос к API</div>
            <label class="pop-label">Название (в логе)</label>
            <input type="text" class="form-control" id="pop-req-title" spellcheck="false" autocomplete="off" value="${esc(req.title || "Запрос")}" placeholder="Поиск Steam до 100₽">
            <label class="pop-label" style="margin-top:10px;">Метод и URL</label>
            <div class="pop-filter-row">
                <select class="form-control" id="pop-req-method" style="font-weight:700;color:var(--lzt-green);">
                    ${["GET", "POST", "PUT", "DELETE"].map(m => `<option value="${m}" ${req.method === m ? "selected" : ""}>${m}</option>`).join("")}
                </select>
                <input type="text" class="form-control" id="pop-req-url" spellcheck="false" autocomplete="off" value="${esc(req.url || "")}" placeholder="https://prod-api.lzt.market/steam">
            </div>
            <label class="pop-label" style="margin-top:10px;">Параметры</label>
            <span class="pop-label-hint">key=value, по одному на строку</span>
            <textarea class="form-control" id="pop-req-params" rows="4" spellcheck="false" autocomplete="off" placeholder="pmin=1&#10;pmax=100&#10;order_by=price_to_up">${esc(paramsText)}</textarea>
            <div class="pop-hint">Подстановки из прошлых блоков: <code>{{last.items.0.item_id}}</code> — в URL или параметрах.</div>
            <details class="pop-advanced" style="margin-top:10px;">
                <summary>Дополнительно</summary>
                <div class="pop-filter-row" style="margin-top:8px;">
                    <div><label class="mini-label">Повторов</label><input type="number" class="form-control" id="pop-req-retries" value="${req.retries != null ? req.retries : 0}" min="0" max="10"></div>
                    <div><label class="mini-label">Пауза, мс</label><input type="number" class="form-control" id="pop-req-delay" value="${req.retryDelay != null ? req.retryDelay : 1000}" min="0" step="100"></div>
                    <div><label class="mini-label">Тайм-аут, сек</label><input type="number" class="form-control" id="pop-req-timeout" value="${req.timeout != null ? req.timeout : 15}" min="1" max="120"></div>
                </div>
                <label class="rate-check" style="margin-top:8px;"><input type="checkbox" id="pop-req-rate" ${req.respectRateLimit !== false ? "checked" : ""}> Ждать при лимите LZT (429)</label>
            </details>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        window.LZTReqParamHints?.bind(pop);
        sc.editingNodeId = node.id;
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            const num = (id, def) => { const n = parseInt(pop.querySelector(id)?.value, 10); return isNaN(n) ? def : n; };
            node.request = {
                method: pop.querySelector("#pop-req-method").value || "GET",
                url: pop.querySelector("#pop-req-url").value.trim(),
                params: sc._reqTextToParams(pop.querySelector("#pop-req-params").value),
                body: req.body || null,
                headers: req.headers || {},
                title: pop.querySelector("#pop-req-title").value.trim() || "Запрос",
                retries: Math.max(0, num("#pop-req-retries", 0)),
                retryDelay: Math.max(0, num("#pop-req-delay", 1000)),
                timeout: Math.max(1, num("#pop-req-timeout", 15)),
                respectRateLimit: pop.querySelector("#pop-req-rate").checked,
            };
            sc.editingNodeId = null;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("filter", ({ sc, node, pop, dismiss, esc, OP_LABELS }) => {
        const f = node.filter;
        const ops = ["<=", "<", ">=", ">", "==", "!="].map(o => `<option value="${o}" ${f.op === o ? "selected" : ""}>${o} (${OP_LABELS[o]})</option>`).join("");
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-filter" style="color:#d68910;"></i> Фильтр списка</div>
            <div class="pop-intro">Берёт список из ответа и оставляет только те элементы, что подходят под условие. Результат сохраняется в переменную.</div>
            <label class="pop-label">Список (путь в ответе)</label>
            <input type="text" class="form-control" id="pop-source" value="${esc(f.source)}" placeholder="last.items">
            <label class="pop-label" style="margin-top:10px;">Оставить элементы, где</label>
            <div class="pop-filter-row">
                <input type="text" class="form-control" id="pop-field" value="${esc(f.field)}" placeholder="price">
                <select class="form-control" id="pop-op" style="max-width:120px;">${ops}</select>
                <input type="text" class="form-control" id="pop-value" value="${esc(f.value)}" placeholder="1000">
            </div>
            <label class="pop-label" style="margin-top:10px;">Сохранить результат как</label>
            <input type="text" class="form-control" id="pop-saveas" value="${esc(f.saveAs)}" placeholder="filtered">
            <div class="pop-hint">Потом используйте <code id="pop-filter-usage">{{vars.${esc(f.saveAs)}}}</code>. Выход <b>«Есть»</b> — если что-то нашлось, <b>«Пусто»</b> — если ничего.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        const saveAsInput = pop.querySelector("#pop-saveas");
        const usage = pop.querySelector("#pop-filter-usage");
        saveAsInput.addEventListener("input", () => { usage.textContent = `{{vars.${saveAsInput.value.trim().replace(/[^\w]/g, "_") || "filtered"}}}`; });
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            f.source = pop.querySelector("#pop-source").value.trim() || "last.items";
            f.field = pop.querySelector("#pop-field").value.trim();
            f.op = pop.querySelector("#pop-op").value;
            f.value = pop.querySelector("#pop-value").value.trim();
            f.saveAs = saveAsInput.value.trim().replace(/[^\w]/g, "_") || "filtered";
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });
})();
