/**
 * Чистая логика движка сценариев (без DOM) — тестируется в Node.
 */
(function () {
    function getPath(obj, path) {
        const parts = String(path).split(".").map(s => s.trim()).filter(Boolean);
        let cur = obj;
        for (const p of parts) {
            if (cur == null) return undefined;
            if (p === "length" && Array.isArray(cur)) { cur = cur.length; continue; }
            cur = cur[p];
        }
        return cur;
    }

    function resolveVars(val, ctx) {
        if (typeof val === "string") {
            return val.replace(/\{\{\s*([^}]+)\s*\}\}/g, (m, path) => {
                const v = getPath(ctx, path.trim());
                return v == null ? "" : (typeof v === "object" ? JSON.stringify(v) : String(v));
            });
        }
        if (Array.isArray(val)) return val.map(v => resolveVars(v, ctx));
        if (val && typeof val === "object") {
            const out = {};
            Object.entries(val).forEach(([k, v]) => { out[k] = resolveVars(v, ctx); });
            return out;
        }
        return val;
    }

    function evalCondition(cond, ctx) {
        const l = cond.left.startsWith("__it.") ? getPath({ __it: ctx.__it }, cond.left) : getPath(ctx, cond.left);
        if (cond.op === "exists") return l !== undefined && l !== null && l !== "";
        const rRaw = typeof cond.right === "string" ? resolveVars(cond.right, ctx) : cond.right;
        if (cond.op === "==" || cond.op === "!=") {
            const eq = String(l) === String(rRaw);
            return cond.op === "==" ? eq : !eq;
        }
        const ln = parseFloat(l), rn = parseFloat(rRaw);
        if (isNaN(ln) || isNaN(rn)) return false;
        if (cond.op === ">") return ln > rn;
        if (cond.op === "<") return ln < rn;
        if (cond.op === ">=") return ln >= rn;
        if (cond.op === "<=") return ln <= rn;
        return false;
    }

    function applyFilter(filter, ctx) {
        const arr = getPath(ctx, filter.source);
        if (!Array.isArray(arr)) return { ok: false, items: [], arr: null };
        const items = arr.filter(item =>
            evalCondition(
                { left: "__it." + filter.field, op: filter.op, right: filter.value },
                Object.assign({}, ctx, { __it: item })
            )
        );
        return { ok: true, items, arr };
    }

    /** Следующий порт цикла: body | done */
    function stepLoop(nodeId, times, counter) {
        const count = counter[nodeId] || 0;
        if (count >= times) {
            counter[nodeId] = 0;
            return { port: "done", iteration: 0, finished: true };
        }
        counter[nodeId] = count + 1;
        return { port: "body", iteration: counter[nodeId], finished: false };
    }

    /** Следующий порт foreach: body | done */
    function stepForeach(nodeId, arr, counter, keySuffix) {
        const key = nodeId + (keySuffix || "_fi");
        if (!Array.isArray(arr)) return { port: "done", error: "not_array", index: -1 };
        const idx = counter[key] || 0;
        if (idx >= arr.length) {
            counter[key] = 0;
            return { port: "done", index: -1, finished: true, length: arr.length };
        }
        counter[key] = idx + 1;
        return { port: "body", index: idx, item: arr[idx], finished: false, length: arr.length };
    }

    /** HTTP < 400 и нет LZT-ошибок в теле (errors / error). */
    function lztResponseOk(status, data) {
        if ((status || 0) >= 400) return false;
        if (data == null) return true;
        if (typeof data !== "object") return true;
        if (Array.isArray(data.errors) && data.errors.length) return false;
        if (data.error) return false;
        return true;
    }

    /** LZT fast-buy: нужно повторить тот же запрос. */
    function isRetryRequest(data) {
        if (data == null) return false;
        const blob = typeof data === "string" ? data : JSON.stringify(data);
        return /retry_request/i.test(blob);
    }

    window.ScenarioEngine = {
        getPath, resolveVars, evalCondition, applyFilter, stepLoop, stepForeach,
        lztResponseOk, isRetryRequest,
    };
})();
