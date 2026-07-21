/* Demo page: live question box -> arcadedb-agent /ask -> answer grid.
   The agent (Agno + Claude) holds a read-only MCP connection to the AML
   graph in ArcadeDB; /ask returns {summary, columns, rows}. */
(function () {
  "use strict";

  var form = document.getElementById("ask-form");
  if (!form) return;

  /* Local dev: run the service locally (uvicorn main:app --port 8081)
     with ALLOWED_ORIGINS including this page's origin. */
  var API_BASE =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:8081"
      : "https://arcadedb-agent-27294773149.us-central1.run.app";

  var questionEl = document.getElementById("ask-question");
  var submitBtn = document.getElementById("ask-submit");
  var statusEl = document.getElementById("ask-status");
  var errorEl = document.getElementById("ask-error");
  var resultEl = document.getElementById("ask-result");
  var summaryEl = document.getElementById("ask-summary");
  var tableEl = document.getElementById("ask-table");

  /* agent/ArcadeDB tab = laundering patterns; 6M/ClickHouse tab = analytical
     questions only (aggregations over the full dataset) */
  var SUGGESTIONS = {
    agent: [
      "Which currency moves the most money?",
      "Find the longest laundering cycle — money returning to its origin",
      "Top fan-in collection points among flagged transactions",
      "Show a scatter-gather pattern: one source, many mules, one collector",
      "Which payment formats are most common in laundering?",
      "all fraud data",
    ],
    clickhouse: [
      "Top currencies by total amount across all 6 million transactions",
      "Most common payment formats in the whole dataset",
      "Average payment amount per currency",
      "Which banks send the most money overall?",
      "Total transaction volume per day",
    ],
  };
  var TAB_NOTE = {
    agent: "Detected laundering patterns & findings (graph database).",
    clickhouse: "Analytics over the full 6-million-transaction dataset (ClickHouse).",
  };
  var currentSource = "agent";
  var suggestionsEl = document.getElementById("ask-suggestions");
  var tabNoteEl = document.getElementById("ask-tab-note");

  function renderSuggestions() {
    if (!suggestionsEl) return;
    suggestionsEl.innerHTML = "";
    SUGGESTIONS[currentSource].forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "slot-btn ask-suggestion";
      b.textContent = q;
      b.addEventListener("click", function () {
        questionEl.value = q;
        questionEl.focus();
      });
      suggestionsEl.appendChild(b);
    });
  }
  renderSuggestions();

  document.querySelectorAll(".ask-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      currentSource = tab.getAttribute("data-source");
      document.querySelectorAll(".ask-tab").forEach(function (t) {
        var on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (tabNoteEl) tabNoteEl.textContent = TAB_NOTE[currentSource];
      if (submitBtn) submitBtn.textContent =
        currentSource === "clickhouse" ? "Ask the 6M database" : "Ask the agent";
      renderSuggestions();
    });
  });

  function setStatus(text, loading) {
    statusEl.textContent = text;
    statusEl.classList.toggle("is-loading", !!loading);
  }

  function renderGrid(columns, rows) {
    tableEl.innerHTML = "";

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    columns.forEach(function (col) {
      var th = document.createElement("th");
      th.textContent = col;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    tableEl.appendChild(thead);

    var tbody = document.createElement("tbody");
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      row.forEach(function (cell) {
        var td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
  }

  /* -- laundering-pattern case panels from the DemoGraph database --
     /demo-graph returns {cases, nodes, edges, banks}: one Scenario per case
     (pattern, note, explanation), Account nodes with a precomputed layout,
     TRANSACTED edges, and base64 bank-logo thumbnails keyed by bank code. */

  var SVG_NS = "http://www.w3.org/2000/svg";
  var casesRoot = document.getElementById("graph-cases");
  var graphStatus = document.getElementById("graph-status");
  var tooltip = document.getElementById("graph-tooltip");
  /* position:fixed breaks under any transformed ancestor (the .reveal
     animation leaves one), so the tooltip must live directly on <body> */
  if (tooltip && tooltip.parentNode !== document.body) {
    document.body.appendChild(tooltip);
  }

  var CELL_W = 560, CELL_H = 400, FIT_M = 46, R_MIN = 10, R_MAX = 16;
  var ROLE_COLOR = {
    origin: "#4D96F0",
    "pass-through": "#B8861E",
    destination: "#C46BD4",
    "ordinary counterparty": "#4C6478",
  };

  function svgEl(name, attrs, parent) {
    var e = document.createElementNS(SVG_NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }

  function fmtAmt(a) {
    if (a >= 1e9) return (a / 1e9).toFixed(1) + "B";
    if (a >= 1e6) return (a / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return (a / 1e3).toFixed(0) + "k";
    return String(Math.round(a));
  }

  function showTooltip(evt, html) {
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    var x = Math.min(evt.clientX + 14, window.innerWidth - tooltip.offsetWidth - 8);
    var y = Math.min(evt.clientY + 14, window.innerHeight - tooltip.offsetHeight - 8);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTooltip() { tooltip.hidden = true; }

  function renderCase(c, nodes, edges, banks, container) {
    container = container || casesRoot;
    var panel = document.createElement("section");
    panel.className = "graph-case";
    var head = document.createElement("div");
    head.className = "graph-case-head";
    var tag = document.createElement("span");
    tag.className = "graph-case-tag";
    tag.textContent = c.tag_label ||
      ("Case " + String(c.case_id).padStart(2, "0") + " · " + c.pattern);
    if (c.note) {
      var em = document.createElement("em");
      em.textContent = " · " + c.note;
      tag.appendChild(em);
    }
    var meta = document.createElement("span");
    meta.className = "graph-case-meta";
    meta.textContent = c.n_accounts + " acct · " + c.n_tx + " tx · " + fmtAmt(c.volume);
    head.appendChild(tag);
    head.appendChild(meta);
    panel.appendChild(head);

    if (c.explanation) {
      var notes = document.createElement("p");
      notes.className = "graph-case-notes";
      notes.textContent = c.explanation;
      panel.appendChild(notes);
    }

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + CELL_W + " " + CELL_H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Case " + c.case_id + ": " + c.pattern +
      " pattern, " + c.n_accounts + " accounts");
    panel.appendChild(svg);
    container.appendChild(panel);

    var defs = svgEl("defs", {}, svg);
    var clip = svgEl("clipPath", { id: "case-clip-" + c.case_id, clipPathUnits: "objectBoundingBox" }, defs);
    svgEl("circle", { cx: "0.5", cy: "0.5", r: "0.5" }, clip);

    /* roles from flagged edges only */
    var flagged = edges.filter(function (e) { return e.is_laundering; });
    var ind = {}, outd = {}, flow = {};
    flagged.forEach(function (e) {
      outd[e.src] = (outd[e.src] || 0) + 1;
      ind[e.dst] = (ind[e.dst] || 0) + 1;
      flow[e.src] = (flow[e.src] || 0) + e.amount;
      flow[e.dst] = (flow[e.dst] || 0) + e.amount;
    });
    function role(n) {
      if (!ind[n.acct_id] && !outd[n.acct_id]) return "ordinary counterparty";
      if (!ind[n.acct_id]) return "origin";
      if (!outd[n.acct_id]) return "destination";
      return "pass-through";
    }
    var maxFlow = 1;
    nodes.forEach(function (n) { maxFlow = Math.max(maxFlow, flow[n.acct_id] || 0); });
    function radius(n) {
      if (n.is_context) return 5.5;
      return R_MIN + (R_MAX - R_MIN) * Math.sqrt((flow[n.acct_id] || 0) / maxFlow);
    }

    /* fit stored layout into the cell: uniform scale, centered */
    var xs = nodes.map(function (n) { return n.x; });
    var ys = nodes.map(function (n) { return n.y; });
    var minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys);
    var w = Math.max(Math.max.apply(null, xs) - minX, 1);
    var h = Math.max(Math.max.apply(null, ys) - minY, 1);
    var s = Math.min((CELL_W - 2 * FIT_M) / w, (CELL_H - 2 * FIT_M) / h);
    var offX = (CELL_W - w * s) / 2, offY = (CELL_H - h * s) / 2;
    var pos = {};
    nodes.forEach(function (n) {
      pos[n.acct_id] = { x: offX + (n.x - minX) * s, y: offY + (n.y - minY) * s };
    });

    var pairKeys = {};
    edges.forEach(function (e) { pairKeys[e.src + " " + e.dst] = true; });
    function twoWay(e) { return pairKeys[e.dst + " " + e.src]; }

    /* uniform thin stroke everywhere; the amount lives in the tooltip */
    function edgeW() { return 1.6; }

    var nodeEls = {};
    var edgeEls = edges.map(function (e, idx) {
      var g = svgEl("g", {}, svg);
      if (!e.is_laundering) g.classList.add("ctx");
      var hit = svgEl("path", { "class": "graph-edge2-hit" }, g);
      var lineId = "edge-" + c.case_id + "-" + idx;
      var line = svgEl("path", {
        id: lineId, "class": "graph-edge2", "stroke-width": edgeW(e.amount).toFixed(1),
      }, g);
      var headEl = svgEl("path", { "class": "graph-edge2-head" }, g);
      // "Deposit" written along the arrow (follows the curve on drag)
      var lbl = svgEl("text", { "class": "graph-edge2-label" }, g);
      var tp = document.createElementNS(SVG_NS, "textPath");
      tp.setAttribute("href", "#" + lineId);
      tp.setAttribute("startOffset", "50%");
      tp.setAttribute("text-anchor", "middle");
      tp.textContent = "Deposit";
      lbl.appendChild(tp);
      return { e: e, g: g, hit: hit, line: line, head: headEl };
    });

    nodes.forEach(function (n) {
      var el = svgEl("circle", {
        "class": "graph-node-c",
        r: radius(n).toFixed(1),
        fill: n.is_start ? ROLE_COLOR.origin : ROLE_COLOR[role(n)],
        tabindex: "0",
      }, svg);
      var img = null;
      var thumb = !n.is_context && banks && banks[n.bank];
      if (thumb) {
        img = svgEl("image", {
          href: "data:image/png;base64," + thumb,
          "clip-path": "url(#case-clip-" + c.case_id + ")",
          preserveAspectRatio: "xMidYMid slice",
        }, svg);
        img.style.pointerEvents = "none";
      }
      var startLbl = null;
      if (n.is_start) {
        startLbl = svgEl("text", { "class": "graph-start-label", "text-anchor": "middle" }, svg);
        startLbl.textContent = "START";
      }
      nodeEls[n.acct_id] = { n: n, el: el, img: img, startLbl: startLbl };
    });

    function drawEdge(ed) {
      var e = ed.e;
      var a = pos[e.src], b = pos[e.dst];
      if (!a || !b) return;
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      var ux = dx / d, uy = dy / d;
      var rB = parseFloat(nodeEls[e.dst].el.getAttribute("r")) + 3;
      var rA = parseFloat(nodeEls[e.src].el.getAttribute("r")) + 2;
      var bow = twoWay(e) ? Math.min(d * 0.18, 30) * (e.src < e.dst ? 1 : -1) : 0;
      var mx = (a.x + b.x) / 2 - uy * bow, my = (a.y + b.y) / 2 + ux * bow;
      var p1x = a.x + ux * rA, p1y = a.y + uy * rA;
      var p2x = b.x - ux * rB, p2y = b.y - uy * rB;
      var dPath = "M" + p1x.toFixed(1) + "," + p1y.toFixed(1) +
        " Q" + mx.toFixed(1) + "," + my.toFixed(1) +
        " " + p2x.toFixed(1) + "," + p2y.toFixed(1);
      ed.line.setAttribute("d", dPath);
      ed.hit.setAttribute("d", dPath);
      var tx = p2x - mx, ty = p2y - my, td = Math.hypot(tx, ty) || 1;
      var ax = tx / td, ay = ty / td, sz = 5 + edgeW(e.amount);
      ed.head.setAttribute("d",
        "M" + p2x + "," + p2y +
        " L" + (p2x - ax * sz - ay * sz * 0.55) + "," + (p2y - ay * sz + ax * sz * 0.55) +
        " L" + (p2x - ax * sz + ay * sz * 0.55) + "," + (p2y - ay * sz - ax * sz * 0.55) + " Z");
    }

    function redraw(acct) {
      var ne = nodeEls[acct];
      ne.el.setAttribute("cx", pos[acct].x.toFixed(1));
      ne.el.setAttribute("cy", pos[acct].y.toFixed(1));
      if (ne.img) {
        var ir = parseFloat(ne.el.getAttribute("r")) - 2.5;
        ne.img.setAttribute("x", (pos[acct].x - ir).toFixed(1));
        ne.img.setAttribute("y", (pos[acct].y - ir).toFixed(1));
        ne.img.setAttribute("width", (2 * ir).toFixed(1));
        ne.img.setAttribute("height", (2 * ir).toFixed(1));
      }
      if (ne.startLbl) {
        var lr = parseFloat(ne.el.getAttribute("r"));
        ne.startLbl.setAttribute("x", pos[acct].x.toFixed(1));
        ne.startLbl.setAttribute("y", (pos[acct].y + lr + 11).toFixed(1));
      }
      edgeEls.forEach(function (ed) {
        if (ed.e.src === acct || ed.e.dst === acct) drawEdge(ed);
      });
    }
    Object.keys(nodeEls).forEach(redraw);

    function toLocal(evt) {
      var pt = new DOMPoint(evt.clientX, evt.clientY);
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }
    function clampX(v) { return Math.max(10, Math.min(CELL_W - 10, v)); }
    function clampY(v) { return Math.max(10, Math.min(CELL_H - 10, v)); }

    function nodeTip(n) {
      /* answer graphs ("askN") skip the case reference — it's noise there */
      var isAsk = String(c.case_id).indexOf("ask") === 0;
      return "<strong>" + (n.bank_name || "Account") + "</strong>" +
        (n.is_start ? " · <span class=\"tt-laundering\">START — round-trip origin</span>" : "") +
        "<br>account " + (n.acct_num || n.acct_id) + " · bank " + n.bank + "<br>" +
        role(n) + (isAsk ? "" : " · case " + c.case_id + " (" + c.pattern + ")");
    }
    function edgeTip(e) {
      var converted = e.currency_received && (e.currency_received !== e.currency ||
        (e.amount_received && e.amount_received !== e.amount));
      return "<strong>Deposit</strong> · " + fmtAmt(e.amount) + " " + e.currency +
        (e.format ? " · " + e.format : "") +
        (converted
          ? "<br>received " + fmtAmt(e.amount_received) + " " + e.currency_received
          : "") +
        (e.is_laundering
          ? "<br><span class=\"tt-laundering\">⚑ flagged as laundering</span>"
          : "<br>ordinary transfer") +
        (e.src_bank_name || e.dst_bank_name
          ? "<br>" + (e.src_bank_name || e.src) + " → " + (e.dst_bank_name || e.dst)
          : "") +
        "<br>" + e.src + " → " + e.dst + "<br>" + (e.ts || "");
    }

    Object.keys(nodeEls).forEach(function (id) {
      var ne = nodeEls[id];
      var drag = null;
      ne.el.addEventListener("pointerdown", function (evt) {
        evt.preventDefault();
        ne.el.setPointerCapture(evt.pointerId);
        var p = toLocal(evt);
        drag = { dx: pos[id].x - p.x, dy: pos[id].y - p.y };
        hideTooltip();
      });
      ne.el.addEventListener("pointermove", function (evt) {
        if (drag) {
          var p = toLocal(evt);
          pos[id].x = clampX(p.x + drag.dx);
          pos[id].y = clampY(p.y + drag.dy);
          redraw(id);
        } else {
          showTooltip(evt, nodeTip(ne.n));
        }
      });
      ne.el.addEventListener("pointerup", function () { drag = null; });
      ne.el.addEventListener("pointerenter", function () { ne.el.classList.add("is-hot"); });
      ne.el.addEventListener("pointerleave", function () {
        ne.el.classList.remove("is-hot");
        hideTooltip();
      });
    });

    edgeEls.forEach(function (ed) {
      var drag = null;
      ed.hit.addEventListener("pointerdown", function (evt) {
        evt.preventDefault();
        ed.hit.setPointerCapture(evt.pointerId);
        drag = toLocal(evt);
        hideTooltip();
      });
      ed.hit.addEventListener("pointermove", function (evt) {
        if (drag) {
          var p = toLocal(evt);
          var dx = p.x - drag.x, dy = p.y - drag.y;
          drag = p;
          [ed.e.src, ed.e.dst].forEach(function (end) {
            pos[end].x = clampX(pos[end].x + dx);
            pos[end].y = clampY(pos[end].y + dy);
            redraw(end);
          });
        } else {
          showTooltip(evt, edgeTip(ed.e));
        }
      });
      ed.hit.addEventListener("pointerup", function () { drag = null; });
      ed.hit.addEventListener("pointerenter", function () { ed.g.classList.add("is-hot"); });
      ed.hit.addEventListener("pointerleave", function () {
        ed.g.classList.remove("is-hot");
        hideTooltip();
      });
    });
  }

  var bankThumbs = {};

  function renderGraph(data) {
    bankThumbs = data.banks || {};
    (data.cases || []).forEach(function (c) {
      var nodes = data.nodes.filter(function (n) { return n.case_id === c.case_id; });
      var edges = data.edges.filter(function (e) { return e.case_id === c.case_id; });
      if (nodes.length) renderCase(c, nodes, edges, bankThumbs);
    });
  }

  /* -- answer graphs: sample flows returned by /ask ----------------------- */

  var askGraphEl = document.getElementById("ask-graph");
  var askGraphSeq = 0;

  /* two-word label per fraud typology (mirrors the server's PATTERN_DESC) */
  var PATTERN_DESC = {
    "cycle": "Round-tripping",
    "fan-in": "Collection funnel",
    "fan-out": "Distribution spray",
    "scatter-gather": "Split reconverge",
    "gather-scatter": "Collect redistribute",
    "chain": "Layering chain",
  };

  function renderAnswerGraph(gnodes, gedges, extraBanks, pattern) {
    if (!askGraphEl) return;
    askGraphEl.innerHTML = "";
    if (!gnodes.length || !gedges.length) return;
    /* merge server-attached logos for banks the base page doesn't know */
    if (extraBanks) {
      Object.keys(extraBanks).forEach(function (code) {
        if (extraBanks[code] && !bankThumbs[code]) bankThumbs[code] = extraBanks[code];
      });
    }

    /* layered layout: one horizontal band per sample group, columns by hop */
    var groups = {};
    gnodes.forEach(function (n) {
      var g = n.group || 1;
      (groups[g] = groups[g] || []).push(n);
    });
    var gkeys = Object.keys(groups);
    gkeys.forEach(function (gk, gi) {
      var members = groups[gk];
      var ids = {};
      members.forEach(function (n) { ids[n.acct_id] = true; });
      /* degrees over FLAGGED edges only: ordinary context edges must not
         break cycle detection */
      /* structure is defined ONLY by the scheme's own edges: exclude
         context/side edges (extra) and ordinary transfers, so dummy edges
         and red mule-to-mule chords never distort the pattern layout */
      function core(e) { return ids[e.src] && ids[e.dst] && e.is_laundering !== 0 && !e.extra; }
      var ind = {}, outd2 = {}, coreTouch = {};
      gedges.forEach(function (e) {
        if (core(e)) {
          ind[e.dst] = (ind[e.dst] || 0) + 1;
          outd2[e.src] = (outd2[e.src] || 0) + 1;
          coreTouch[e.src] = true; coreTouch[e.dst] = true;
        }
      });
      /* a pure cycle (every node 1-in 1-out over core edges) draws as a ring */
      var cycleMembers = members.filter(function (n) {
        return ind[n.acct_id] === 1 && outd2[n.acct_id] === 1;
      });
      var extras = members.filter(function (n) { return cycleMembers.indexOf(n) === -1; });
      var isCycle = cycleMembers.length >= 3 &&
        cycleMembers.length >= members.filter(function (n) { return coreTouch[n.acct_id]; }).length;
      if (isCycle) {
        var bandH0 = CELL_H / gkeys.length, y00 = gi * bandH0;
        var cx = CELL_W / 2, cy = y00 + bandH0 / 2;
        var rX = CELL_W / 2 - 90, rY = bandH0 / 2 - 40;
        /* walk the ring in scheme-edge order */
        var nxt = {};
        gedges.forEach(function (e) { if (core(e)) nxt[e.src] = e.dst; });
        /* walk the ring starting at the marked start account (top position) */
        var startMember = cycleMembers.filter(function (n) { return n.is_start; })[0] || cycleMembers[0];
        var seq = [startMember.acct_id];
        while (nxt[seq[seq.length - 1]] && seq.indexOf(nxt[seq[seq.length - 1]]) === -1) {
          seq.push(nxt[seq[seq.length - 1]]);
        }
        var byId2 = {};
        cycleMembers.forEach(function (n) { byId2[n.acct_id] = n; });
        seq.forEach(function (id, i) {
          var a = 2 * Math.PI * i / seq.length - Math.PI / 2;
          if (byId2[id]) {
            byId2[id].x = cx + rX * Math.cos(a);
            byId2[id].y = cy + rY * Math.sin(a);
          }
        });
        /* ordinary context accounts sit outside the ring, next to the
           cycle account they transact with */
        extras.forEach(function (n) {
          var link = null;
          gedges.forEach(function (e) {
            if (e.src === n.acct_id && byId2[e.dst]) link = byId2[e.dst];
            if (e.dst === n.acct_id && byId2[e.src]) link = byId2[e.src];
          });
          if (link) {
            n.x = cx + (link.x - cx) * 1.55;
            n.y = cy + (link.y - cy) * 1.55;
          } else {
            n.x = cx;
            n.y = y00 + 26;
          }
          n.x = Math.max(40, Math.min(CELL_W - 40, n.x));
          n.y = Math.max(24, Math.min(y00 + bandH0 - 24, n.y));
        });
        return;
      }
      /* layered layout over CORE nodes only (dummies placed afterwards) */
      var coreMembers = members.filter(function (n) { return coreTouch[n.acct_id]; });
      if (!coreMembers.length) coreMembers = members.slice();
      var depth = {}, queue = [];
      coreMembers.forEach(function (n) {
        if (!ind[n.acct_id]) { depth[n.acct_id] = 0; queue.push(n.acct_id); }
      });
      if (!queue.length && coreMembers.length) {
        depth[coreMembers[0].acct_id] = 0;
        queue.push(coreMembers[0].acct_id);
      }
      while (queue.length) {
        var cur = queue.shift();
        gedges.forEach(function (e) {
          if (core(e) && e.src === cur && depth[e.dst] === undefined) {
            depth[e.dst] = depth[cur] + 1;
            queue.push(e.dst);
          }
        });
      }
      var maxD = 0;
      coreMembers.forEach(function (n) {
        if (depth[n.acct_id] === undefined) depth[n.acct_id] = 0;
        maxD = Math.max(maxD, depth[n.acct_id]);
      });
      var byD = {};
      coreMembers.forEach(function (n) {
        var d = depth[n.acct_id];
        (byD[d] = byD[d] || []).push(n);
      });
      var bandH = CELL_H / gkeys.length, y0 = gi * bandH;
      var byId3 = {};
      coreMembers.forEach(function (n) { byId3[n.acct_id] = n; });
      Object.keys(byD).forEach(function (d) {
        var col = byD[d];
        /* stagger crowded columns into a zigzag so nodes don't touch */
        var jog = col.length > 6 ? 42 : 0;
        col.forEach(function (n, i) {
          n.x = 70 + (CELL_W - 140) * (maxD ? d / maxD : 0.5) + (i % 2 ? jog : -jog);
          n.y = y0 + bandH * ((i + 0.5) / col.length);
        });
      });
      /* dummy context accounts sit just outside the scheme node they touch */
      members.filter(function (n) { return !coreTouch[n.acct_id]; }).forEach(function (n, k) {
        var link = null;
        gedges.forEach(function (e) {
          if (e.src === n.acct_id && byId3[e.dst]) link = byId3[e.dst];
          if (e.dst === n.acct_id && byId3[e.src]) link = byId3[e.src];
        });
        var ang = k * 1.1;
        var bx = link ? link.x : CELL_W / 2, by = link ? link.y : y0 + bandH / 2;
        n.x = Math.max(30, Math.min(CELL_W - 30, bx + Math.cos(ang) * 44));
        n.y = Math.max(y0 + 20, Math.min(y0 + bandH - 20, by + Math.sin(ang) * 34));
      });
    });

    var nodes = gnodes.map(function (n) {
      return {
        acct_id: n.acct_id,
        acct_num: n.acct_id.split("_")[1] || n.acct_id,
        bank: n.acct_id.split("_")[0],
        bank_name: n.bank_name || "",
        x: n.x, y: n.y, is_context: 0, is_start: n.is_start || 0,
      };
    });
    var edges = gedges.map(function (e) {
      return {
        src: e.src, dst: e.dst,
        amount: e.amount || 0, currency: e.currency || "",
        amount_received: e.amount || 0, currency_received: e.currency || "",
        format: "", ts: e.ts || "",
        is_laundering: e.is_laundering === 0 ? 0 : 1,
      };
    });
    var desc = PATTERN_DESC[pattern] || "";
    var c = {
      case_id: "ask" + (++askGraphSeq),
      pattern: desc || pattern || "sample flow",
      tag_label: "Sample flow" + (desc ? " · " + desc : "") +
        (gkeys.length > 1 ? " · " + gkeys.length + " groups" : ""),
      note: "", explanation: "",
      n_accounts: nodes.length, n_tx: edges.length,
      volume: edges.reduce(function (s, e) { return s + e.amount; }, 0),
    };
    renderCase(c, nodes, edges, bankThumbs, askGraphEl);
  }

  if (casesRoot) {
    fetch(API_BASE + "/demo-graph")
      .then(function (r) {
        if (!r.ok) throw new Error("demo-graph " + r.status);
        return r.json();
      })
      .then(function (data) {
        renderGraph(data);
        graphStatus.textContent = "";
        graphStatus.classList.remove("is-loading");
      })
      .catch(function () {
        graphStatus.textContent = "Couldn't load the graph right now — the rest of the demo still works.";
        graphStatus.classList.remove("is-loading");
      });
  }

  /* -- database size table: shown when a question runs ------------------- */

  /* CSV export of everything the agent has logged to ClickHouse */
  /* per-answer download: the results THIS query returned (all rows, e.g.
     every edge of a cycle). Built client-side from the answer grid. */
  var dlAnswer = document.getElementById("download-answer");
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildAnswerCsv(cols, rows, path) {
    /* each row also carries its raw JSON and the full path (same per query) */
    var header = cols.concat(["raw", "path"]);
    var pathStr = JSON.stringify(path || {});
    var lines = [header.map(csvCell).join(",")];
    rows.forEach(function (r) {
      var rawObj = {};
      cols.forEach(function (c, j) { rawObj[c] = r[j]; });
      lines.push(r.concat([JSON.stringify(rawObj), pathStr]).map(csvCell).join(","));
    });
    return lines.join("\r\n");
  }
  function setAnswerDownload(cols, rows, path) {
    if (!dlAnswer) return;
    if (!rows || !rows.length) { dlAnswer.hidden = true; return; }
    var csv = buildAnswerCsv(cols || [], rows, path);
    if (dlAnswer._url) URL.revokeObjectURL(dlAnswer._url);
    dlAnswer._url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    dlAnswer.href = dlAnswer._url;
    dlAnswer.hidden = false;
  }

  var statsEl = document.getElementById("db-stats");
  var statsLoaded = false;

  function loadStats() {
    if (statsLoaded || !statsEl) return;
    statsLoaded = true;
    fetch(API_BASE + "/stats")
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var n = function (v) { return Number(v).toLocaleString(); };
        statsEl.innerHTML =
          '<div class="post-table-wrap"><table><thead><tr>' +
          "<th>Database being queried</th><th>Accounts</th><th>Transfers</th><th>Findings</th>" +
          "</tr></thead><tbody>" +
          "<tr><td>AML_6mil_demo — live transaction graph</td><td>" +
          n(s.aml.accounts) + "</td><td>" + n(s.aml.transfers) + "</td><td>—</td></tr>" +
          "<tr><td>AML_findings — structural pattern detections</td><td>" +
          n(s.findings.accounts) + "</td><td>" + n(s.findings.transfers) + "</td><td>" +
          n(s.findings.findings) + "</td></tr>" +
          "</tbody></table></div>";
      })
      .catch(function () { statsLoaded = false; });
  }
  loadStats();

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var question = questionEl.value.trim();
    if (!question) {
      questionEl.focus();
      return;
    }
    if (statsEl) { statsEl.hidden = false; loadStats(); }

    errorEl.hidden = true;
    resultEl.hidden = true;
    submitBtn.disabled = true;
    setStatus("The agent is querying the graph… this can take up to a minute.", true);

    fetch(API_BASE + "/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question, source: currentSource }),
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (res) {
        setStatus("");
        if (res.ok && res.data && res.data.columns) {
          /* once an answer renders, the intro sample-case panels make way */
          var demoCases = document.getElementById("demo-cases");
          if (demoCases) demoCases.hidden = true;
          summaryEl.textContent = res.data.summary || "";
          renderGrid(res.data.columns, res.data.rows || []);
          setAnswerDownload(res.data.columns, res.data.rows || [], res.data.path || {});
          renderAnswerGraph(res.data.graph_nodes || [], res.data.graph_edges || [],
            res.data.banks || {}, res.data.pattern || "");
          resultEl.hidden = false;
          resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else if (res.status === 429) {
          errorEl.textContent = "Too many questions from this address — please try again in a few minutes.";
          errorEl.hidden = false;
        } else {
          errorEl.textContent = "The agent couldn't answer that right now. Please try again, or rephrase the question.";
          errorEl.hidden = false;
        }
      })
      .catch(function () {
        setStatus("");
        errorEl.textContent = "Couldn't reach the demo agent. Please try again in a moment.";
        errorEl.hidden = false;
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
})();
