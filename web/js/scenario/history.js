/** Undo/redo и автосохранение черновика. */
window.ScenarioHistoryMixin = {
    autosave() {
        try {
            const data = this.serialize();
            localStorage.setItem("lzt_scenario_autosave", JSON.stringify(data));
            if (window.LZTScenarioStore) {
                LZTScenarioStore.saveAutosave(data).catch(() => {});
            }
        } catch (e) {}
    },
    resetHistory() {
        this.history = [JSON.stringify(this.serialize())];
        this.histIndex = 0;
    },
    pushHistory() {
        if (this._restoring) return;
        this.history = this.history.slice(0, this.histIndex + 1);
        this.history.push(JSON.stringify(this.serialize()));
        if (this.history.length > 60) this.history.shift();
        this.histIndex = this.history.length - 1;
    },
    commit() {
        if (this._restoring) return;
        this.pushHistory();
        if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
        this._autosaveTimer = setTimeout(() => {
            this._autosaveTimer = 0;
            this.autosave();
        }, 450);
    },
    undo() {
        if (this.histIndex <= 0) return;
        this.histIndex--;
        this._restoring = true;
        this.load(JSON.parse(this.history[this.histIndex]), { keepView: true });
        this._restoring = false;
        this.autosave();
    },
    redo() {
        if (this.histIndex >= this.history.length - 1) return;
        this.histIndex++;
        this._restoring = true;
        this.load(JSON.parse(this.history[this.histIndex]), { keepView: true });
        this._restoring = false;
        this.autosave();
    },
};
