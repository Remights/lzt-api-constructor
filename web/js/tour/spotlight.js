/** Spotlight: geometry vs visual — чистые функции + DOM ring/cutouts. */
(function () {
    "use strict";

    const { PAD, isVisible } = window.TourUtil;

    function spotKey(items) {
        return items.map(it => {
            const q = (n) => Math.round(n / 2) * 2;
            return `${q(it.top)}:${q(it.left)}:${q(it.width)}:${q(it.height)}`;
        }).join("|");
    }

    function spotVisKey(geomKey, spotOpts) {
        return `${geomKey}|p:${spotOpts.pulse ? 1 : 0}|g:${spotOpts.glowOnly ? 1 : 0}`;
    }

    function unionRect(rects) {
        const ok = rects.filter(Boolean);
        if (!ok.length) return null;
        const top = Math.min(...ok.map(r => r.top));
        const left = Math.min(...ok.map(r => r.left));
        const right = Math.max(...ok.map(r => r.left + r.width));
        const bottom = Math.max(...ok.map(r => r.top + r.height));
        return { top, left, width: right - left, height: bottom - top };
    }

    function rectsOverlap(a, b, pad) {
        pad = pad || 0;
        return !(a.left + a.width + pad < b.left
            || b.left + b.width + pad < a.left
            || a.top + a.height + pad < b.top
            || b.top + b.height + pad < a.top);
    }

    function rectFor(el, pad) {
        pad = pad != null ? pad : PAD;
        if (!el || !isVisible(el)) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        return {
            top: Math.max(4, r.top - pad),
            left: Math.max(4, r.left - pad),
            width: r.width + pad * 2,
            height: r.height + pad * 2,
        };
    }

    function itemSpot(el, pad, portSpotFn) {
        if (el?.classList?.contains("sport")) return portSpotFn(el);
        const rect = rectFor(el, pad);
        return rect ? { el, isPort: false, rect, ...rect } : null;
    }

    function hideSpotModes(spot) {
        spot.top.style.display = "none";
        spot.left.style.display = "none";
        spot.right.style.display = "none";
        spot.bottom.style.display = "none";
        spot.ring.style.display = "none";
        spot.full.style.display = "none";
    }

    function ensureSpotDom(cutoutsEl) {
        if (cutoutsEl._spot) return cutoutsEl._spot;
        const full = document.createElement("div");
        full.className = "tour-spotlight-backdrop";
        cutoutsEl.appendChild(full);
        const mkDim = (side) => {
            const d = document.createElement("div");
            d.className = "tour-dim tour-dim-" + side;
            cutoutsEl.appendChild(d);
            return d;
        };
        const ring = document.createElement("div");
        ring.className = "tour-spot-ring-box";
        cutoutsEl.appendChild(ring);
        cutoutsEl._spot = {
            full,
            top: mkDim("top"),
            left: mkDim("left"),
            right: mkDim("right"),
            bottom: mkDim("bottom"),
            ring,
        };
        return cutoutsEl._spot;
    }

    function applySpotGeometry(spot, items, soft) {
        if (!items.length) {
            hideSpotModes(spot);
            spot.full.style.display = "";
            return null;
        }
        const union = unionRect(items.map(x => ({ top: x.top, left: x.left, width: x.width, height: x.height })));
        if (!union) {
            if (!soft) hideSpotModes(spot);
            spot.full.style.display = "";
            return null;
        }
        if (!soft || spot.ring.style.display === "none") hideSpotModes(spot);
        const { top, left, width, height } = union;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const bottom = top + height;
        const right = left + width;
        spot.top.style.display = "";
        spot.top.style.height = Math.max(0, top) + "px";
        spot.left.style.display = "";
        spot.left.style.top = top + "px";
        spot.left.style.width = Math.max(0, left) + "px";
        spot.left.style.height = height + "px";
        spot.right.style.display = "";
        spot.right.style.top = top + "px";
        spot.right.style.left = right + "px";
        spot.right.style.width = Math.max(0, vw - right) + "px";
        spot.right.style.height = height + "px";
        spot.bottom.style.display = "";
        spot.bottom.style.top = bottom + "px";
        spot.bottom.style.height = Math.max(0, vh - bottom) + "px";
        spot.ring.style.display = "";
        spot.ring.style.top = top + "px";
        spot.ring.style.left = left + "px";
        spot.ring.style.width = width + "px";
        spot.ring.style.height = height + "px";
        return union;
    }

    /** Visual layer: классы анимации. bump — только при явном opts.bump. */
    function applySpotVisual(spot, items, opts) {
        opts = opts || {};
        const union = applySpotGeometry(spot, items, !!opts.soft);
        if (!union) {
            spot.ring.classList.remove("tour-ring-pulse", "tour-ring-bump", "tour-ring-glow-only", "is-port");
            return null;
        }
        const ring = spot.ring;
        const isPortRing = items.length === 1 && items[0]?.isPort;
        const glowOnly = !!opts.glowOnly;
        const pulse = !!opts.pulse && !glowOnly;
        ring.classList.toggle("is-port", isPortRing);
        ring.classList.toggle("tour-ring-glow-only", glowOnly);
        ring.classList.toggle("tour-ring-pulse", pulse);
        if (opts.bump) {
            ring.classList.remove("tour-ring-bump");
            void ring.offsetWidth;
            ring.classList.add("tour-ring-bump");
        }
        return union;
    }

    function ringHasSpotVisual(spot) {
        const ring = spot.ring;
        return ring.style.display !== "none" && (
            ring.classList.contains("tour-ring-pulse")
            || ring.classList.contains("tour-ring-glow-only")
        );
    }

    function resolveSpotOpts(meta) {
        let pulse = !!(meta.pulse || meta.highlightPorts);
        let glowOnly = false;
        if (typeof meta.spotStyle === "function") {
            const st = meta.spotStyle() || {};
            if (st.pulse != null) pulse = !!st.pulse;
            if (st.glowOnly != null) glowOnly = !!st.glowOnly;
        } else if (meta.spotGlowOnly) {
            glowOnly = true;
            pulse = false;
        }
        return { pulse, glowOnly };
    }

    function resolveTargets(meta, ctx) {
        if (meta.multiTarget && meta.targets) {
            const raw = typeof meta.targets === "function" ? meta.targets(ctx) : meta.targets;
            const els = (raw || []).map(el => (typeof el === "string" ? document.querySelector(el) : el)).filter(el => el && isVisible(el));
            if (els.length) return els;
        }
        let el = typeof meta.target === "function" ? meta.target(ctx) : document.querySelector(meta.target);
        if ((!el || !isVisible(el)) && meta.fallbackTarget) {
            el = typeof meta.fallbackTarget === "function"
                ? meta.fallbackTarget(ctx)
                : document.querySelector(meta.fallbackTarget);
        }
        return el && isVisible(el) ? [el] : [];
    }

    function renderFullDim(cutoutsEl) {
        applySpotVisual(ensureSpotDom(cutoutsEl), []);
    }

    window.TourSpotlight = {
        spotKey,
        spotVisKey,
        unionRect,
        rectsOverlap,
        rectFor,
        itemSpot,
        hideSpotModes,
        ensureSpotDom,
        applySpotGeometry,
        applySpotVisual,
        ringHasSpotVisual,
        resolveSpotOpts,
        resolveTargets,
        renderFullDim,
    };
})();
