/** Профили API-токенов (мульти-аккаунт) — localStorage. */
(function () {
    "use strict";
    const PROFILES_KEY = "lzt_token_profiles";
    const ACTIVE_KEY = "lzt_token_profile_id";

    function uid() {
        return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function loadAll() {
        try {
            const arr = JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]");
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function saveAll(list) {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(list || []));
    }

    function ensureMigrated() {
        let list = loadAll();
        const token = (localStorage.getItem("lzt_api_token") || "").trim();
        if (!list.length && token) {
            const id = uid();
            list = [{ id, name: "Основной", token }];
            saveAll(list);
            localStorage.setItem(ACTIVE_KEY, id);
        }
        return list;
    }

    function activeId() {
        ensureMigrated();
        return localStorage.getItem(ACTIVE_KEY) || "";
    }

    function getActive() {
        const list = ensureMigrated();
        const id = activeId();
        return list.find((p) => p.id === id) || list[0] || null;
    }

    function setActive(id) {
        const list = loadAll();
        const p = list.find((x) => x.id === id);
        if (!p) return false;
        localStorage.setItem(ACTIVE_KEY, id);
        if (window.LZTToken) window.LZTToken.set(p.token || "");
        else localStorage.setItem("lzt_api_token", p.token || "");
        return true;
    }

    function upsert(name, token, id) {
        const list = ensureMigrated();
        const n = (name || "Профиль").trim() || "Профиль";
        const t = (token || "").trim();
        if (id) {
            const p = list.find((x) => x.id === id);
            if (p) {
                p.name = n;
                p.token = t;
            }
        } else {
            id = uid();
            list.push({ id, name: n, token: t });
        }
        saveAll(list);
        localStorage.setItem(ACTIVE_KEY, id);
        if (window.LZTToken) window.LZTToken.set(t);
        return id;
    }

    function remove(id) {
        let list = loadAll().filter((p) => p.id !== id);
        saveAll(list);
        if (activeId() === id) {
            if (list[0]) setActive(list[0].id);
            else {
                localStorage.removeItem(ACTIVE_KEY);
                if (window.LZTToken) window.LZTToken.set("");
            }
        }
    }

    function syncFromTokenSet(token) {
        const list = ensureMigrated();
        const id = activeId();
        const p = list.find((x) => x.id === id);
        if (p) {
            p.token = (token || "").trim();
            saveAll(list);
        } else if ((token || "").trim()) {
            upsert("Основной", token);
        }
    }

    window.LZTTokenProfiles = {
        list: () => ensureMigrated(),
        activeId,
        getActive,
        setActive,
        upsert,
        remove,
        syncFromTokenSet,
    };
})();
