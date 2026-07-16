/** Popover-редакторы: foreach, checker, sniper, ИИ, под-сценарий. */
(function () {
    "use strict";
    const R = () => window.ScenarioPropEditorRegistry;
    if (!R()) return;

    R().register("foreach", ({ sc, node, pop, dismiss, esc }) => {
        const fe = node.foreach;
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-list-ul" style="color:#8e44ad;"></i> Для каждого</div>
            <label class="pop-label">Список (путь)</label>
            <input type="text" class="form-control" id="pop-source" value="${esc(fe.source)}" placeholder="last.items">
            <label class="pop-label" style="margin-top:10px;">Имя переменной элемента</label>
            <input type="text" class="form-control" id="pop-itemvar" value="${esc(fe.itemVar)}" placeholder="item">
            <label class="pop-label" style="margin-top:10px;">Имя переменной индекса</label>
            <input type="text" class="form-control" id="pop-idxvar" value="${esc(fe.indexVar || "i")}" placeholder="i">
            <div class="pop-hint">Тело подключите к выходу «Тело». После каждого элемента верните линию на вход блока.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            fe.source = pop.querySelector("#pop-source").value.trim() || "last.items";
            fe.itemVar = pop.querySelector("#pop-itemvar").value.trim().replace(/[^\w]/g, "_") || "item";
            fe.indexVar = pop.querySelector("#pop-idxvar").value.trim().replace(/[^\w]/g, "_") || "i";
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("checker", ({ sc, node, pop, dismiss, esc }) => {
        const c = node.checker;
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-user-check" style="color:#2980b9;"></i> Проверка аккаунта</div>
            <label class="pop-label">ID лота (путь или число)</label>
            <input type="text" class="form-control" id="pop-itempath" value="${esc(c.itemPath)}" placeholder="last.items.0.item_id">
            <label class="rate-check" style="margin-top:10px;"><input type="checkbox" id="pop-rejectsold" ${c.rejectSold !== false ? "checked" : ""}> Считать проданный/недоступный лот «битым»</label>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            c.itemPath = pop.querySelector("#pop-itempath").value.trim() || "last.items.0.item_id";
            c.rejectSold = pop.querySelector("#pop-rejectsold").checked;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("sniper", ({ sc, node, pop, dismiss, esc }) => {
        const sn = node.sniper;
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-crosshairs" style="color:#c0392b;"></i> Снайпер — автопокупка</div>
            <label class="pop-label">Список лотов (путь)</label>
            <input type="text" class="form-control" id="pop-source" value="${esc(sn.source)}" placeholder="last.items">
            <div class="reliability-row" style="margin-top:10px;">
                <div><label class="mini-label">Макс. цена, ₽</label><input type="text" class="form-control" id="pop-maxp" value="${esc(sn.maxPrice)}"></div>
                <div><label class="mini-label">Лимит трат, ₽</label><input type="text" class="form-control" id="pop-maxs" value="${esc(sn.maxSpend)}"></div>
            </div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            sn.source = pop.querySelector("#pop-source").value.trim() || "last.items";
            sn.maxPrice = pop.querySelector("#pop-maxp").value.trim() || "100";
            sn.maxSpend = pop.querySelector("#pop-maxs").value.trim() || "5000";
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("ai", ({ sc, node, pop, dismiss, esc }) => {
        const a = node.ai || {};
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-brain" style="color:#9b59b6;"></i> ИИ — оценка лотов</div>
            <label class="pop-label">Список лотов (путь)</label>
            <input type="text" class="form-control" id="pop-source" value="${esc(a.source)}" placeholder="vars.filtered">
            <label class="pop-label" style="margin-top:10px;">Сохранить ответ как</label>
            <input type="text" class="form-control" id="pop-outvar" value="${esc(a.outputVar || "ai_result")}" placeholder="ai_result">
            <label class="rate-check" style="margin-top:10px;"><input type="checkbox" id="pop-batch" ${a.batch !== false ? "checked" : ""}> Пакетная оценка (до N лотов)</label>
            <input type="number" class="form-control" id="pop-batchlimit" value="${a.batchLimit || 50}" min="1" max="200" style="margin-top:6px;">
            <label class="pop-label" style="margin-top:10px;">Промпт</label>
            <textarea class="form-control" id="pop-prompt" rows="4">${esc(a.prompt || "")}</textarea>
            <div class="pop-hint">Ключ ИИ — в AI+ / настройках. В демо-режиме ответ mock без API.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            a.source = pop.querySelector("#pop-source").value.trim() || "last.items";
            a.outputVar = pop.querySelector("#pop-outvar").value.trim().replace(/[^\w]/g, "_") || "ai_result";
            a.batch = pop.querySelector("#pop-batch").checked;
            a.batchLimit = parseInt(pop.querySelector("#pop-batchlimit").value, 10) || 50;
            a.prompt = pop.querySelector("#pop-prompt").value;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("script", ({ sc, node, pop, dismiss, esc }) => {
        const s = node.script || (node.script = { filename: "", timeout: 30, saveAs: "script_out" });
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-puzzle-piece" style="color:#e67e22;"></i> Скрипт (хук)</div>
            <label class="pop-label">Файл в папке hooks</label>
            <input type="text" class="form-control" id="pop-fname" value="${esc(s.filename || "")}" placeholder="hook_example.py">
            <label class="pop-label" style="margin-top:10px;">Сохранить stdout JSON как</label>
            <input type="text" class="form-control" id="pop-saveas" value="${esc(s.saveAs || "script_out")}" placeholder="script_out">
            <label class="pop-label" style="margin-top:10px;">Timeout, сек</label>
            <input type="number" class="form-control" id="pop-timeout" value="${s.timeout || 30}" min="1" max="120">
            <div class="pop-hint">Скрипт получает JSON в stdin (hook/last/vars) и должен печатать JSON в stdout. Путь к папке — в Настройках → Webhooks.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            s.filename = pop.querySelector("#pop-fname").value.trim();
            s.saveAs = pop.querySelector("#pop-saveas").value.trim().replace(/[^\w]/g, "_") || "script_out";
            s.timeout = parseInt(pop.querySelector("#pop-timeout").value, 10) || 30;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("subscenario", ({ sc, node, pop, dismiss, esc }) => {
        const ss = node.subscenario;
        let opts = "";
        try {
            sc._savedScenarios().forEach(t => {
                opts += `<option value="${esc(t.id)}" ${ss.templateId === t.id ? "selected" : ""}>${esc(t.title)}</option>`;
            });
        } catch (e) { /* ignore */ }
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-layer-group" style="color:#34495e;"></i> Под-сценарий</div>
            <label class="pop-label">Сохранённый сценарий</label>
            <select class="form-control" id="pop-tpl"><option value="">— выберите —</option>${opts}</select>
            <div class="pop-hint">Выполнит цепочку выбранного сценария с текущим контекстом переменных.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            ss.templateId = pop.querySelector("#pop-tpl").value;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });
})();
