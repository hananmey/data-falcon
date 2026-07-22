/* Booking page: next 8 business days -> free slots -> book.
   Backed by the booking-service Cloud Run API (GET /slots, POST /book).
   Days and times are in the business timezone (Asia/Jerusalem) to match
   the service's WORK_DAYS/BOOKING_TZ; the API is the source of truth for
   which slots are actually free. */
(function () {
  "use strict";

  var dayGrid = document.getElementById("day-grid");
  if (!dayGrid) return;

  /* Local dev: run the service locally (uvicorn main:app --port 8080)
     with ALLOWED_ORIGINS including http://localhost:8000. */
  /* localhost uses the deployed service too -- local Calendar auth needs an
     impersonated ADC that is rarely set up; the Cloud Run service just works */
  var API_BASE = "https://booking-service-27294773149.us-central1.run.app";

  var BUSINESS_TZ = "Asia/Jerusalem";
  var BUSINESS_DAYS = 8; /* days with availability to offer */
  var MIN_LEAD_DAYS = 2; /* earliest bookable day; mirrors the service's MIN_NOTICE_MINUTES */
  var HORIZON_DAYS = 30; /* how far ahead to look; mirrors the service's BOOKING_HORIZON_DAYS */
  var WORK_DAYS = [0, 1, 2, 3, 4]; /* Sun–Thu, JS getUTCDay numbering */

  var slotGrid = document.getElementById("slot-grid");
  var statusEl = document.getElementById("booking-status");
  var form = document.getElementById("booking-form");
  var summaryEl = document.getElementById("booking-summary");
  var submitBtn = document.getElementById("booking-submit");
  var noteEl = document.getElementById("booking-note");
  var errorEl = document.getElementById("booking-error");
  var successEl = document.getElementById("booking-success");
  var successWhenEl = document.getElementById("booking-success-when");

  var selectedDate = null; /* "YYYY-MM-DD" */
  var selectedSlot = null; /* ISO datetime string from the API */
  var slotMinutes = 30;

  /* -- date helpers (all math on UTC-noon Dates to dodge DST edges) -- */

  function todayInBusinessTz() {
    /* en-CA formats as YYYY-MM-DD */
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
  }

  function toUtcNoon(dateStr) {
    return new Date(dateStr + "T12:00:00Z");
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function businessDaysWithinHorizon() {
    var days = [];
    var start = toUtcNoon(todayInBusinessTz());
    for (var i = MIN_LEAD_DAYS; i <= HORIZON_DAYS; i++) {
      var d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      if (WORK_DAYS.indexOf(d.getUTCDay()) !== -1) days.push(isoDate(d));
    }
    return days;
  }

  function fmtDay(dateStr, opts) {
    return new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: "UTC" }, opts))
      .format(toUtcNoon(dateStr));
  }

  function fmtTime(iso, tz) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  /* -- rendering -- */

  function setStatus(text, loading) {
    statusEl.textContent = text;
    statusEl.classList.toggle("is-loading", !!loading);
  }

  function clearSelection() {
    selectedSlot = null;
    summaryEl.hidden = true;
    submitBtn.disabled = true;
    noteEl.hidden = false;
    form.hidden = true;
  }

  function addDayButton(dateStr) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day-btn";
    btn.dataset.date = dateStr;
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML =
      '<span class="day-dow">' + fmtDay(dateStr, { weekday: "short" }) + "</span>" +
      '<span class="day-date">' + fmtDay(dateStr, { day: "numeric", month: "short" }) + "</span>";
    btn.addEventListener("click", function () { selectDay(dateStr); });
    dayGrid.appendChild(btn);
  }

  function fetchSlots(dateStr) {
    return fetch(API_BASE + "/slots?date=" + dateStr).then(function (r) {
      if (!r.ok) throw new Error("slots " + r.status);
      return r.json();
    });
  }

  /* Only offer days that actually have free times: probe candidate days in
     chronological batches and keep going further out until BUSINESS_DAYS
     days with availability are shown (or the booking horizon runs out). */
  function renderDays() {
    var candidates = businessDaysWithinHorizon();
    var BATCH = 8;
    var shown = 0;

    setStatus("Loading available days…", true);

    function probeBatch(startIdx) {
      if (startIdx >= candidates.length || shown >= BUSINESS_DAYS) {
        finish();
        return;
      }
      var batch = candidates.slice(startIdx, startIdx + BATCH);
      Promise.all(
        batch.map(function (dateStr) {
          return fetchSlots(dateStr)
            .then(function (data) { return { date: dateStr, free: data.slots.length > 0 }; })
            /* On error keep the day visible — clicking it retries and surfaces the problem. */
            .catch(function () { return { date: dateStr, free: true }; });
        })
      ).then(function (results) {
        results.forEach(function (res) {
          if (res.free && shown < BUSINESS_DAYS) {
            addDayButton(res.date);
            shown++;
          }
        });
        probeBatch(startIdx + BATCH);
      });
    }

    function finish() {
      if (selectedDate) return; /* user already picked a day; leave its status alone */
      if (shown) {
        setStatus("Select a day to see available times.");
      } else {
        setStatus("No free times in the coming weeks — please reach out via the contact page.");
      }
    }

    probeBatch(0);
  }

  function markSelected(grid, btnClass, value, dataKey) {
    grid.querySelectorAll("." + btnClass).forEach(function (b) {
      var on = b.dataset[dataKey] === value;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function selectDay(dateStr) {
    selectedDate = dateStr;
    clearSelection();
    markSelected(dayGrid, "day-btn", dateStr, "date");
    loadSlots(dateStr);
  }

  function loadSlots(dateStr) {
    slotGrid.innerHTML = "";
    setStatus("Loading times…", true);

    fetchSlots(dateStr)
      .then(function (data) {
        if (selectedDate !== dateStr) return; /* stale response */
        slotMinutes = data.slot_minutes || slotMinutes;
        if (!data.slots.length) {
          /* Day filled up since it was offered — drop it from the grid. */
          var dayBtn = dayGrid.querySelector('.day-btn[data-date="' + dateStr + '"]');
          if (dayBtn) dayBtn.remove();
          setStatus(fmtDay(dateStr, { weekday: "long", day: "numeric", month: "long" }) + " just filled up — please pick another day.");
          return;
        }
        setStatus("");
        data.slots.forEach(function (iso) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "slot-btn";
          btn.dataset.slot = iso;
          btn.setAttribute("aria-pressed", "false");
          btn.textContent = fmtTime(iso, BUSINESS_TZ);
          btn.addEventListener("click", function () { selectSlot(iso); });
          slotGrid.appendChild(btn);
        });
      })
      .catch(function () {
        if (selectedDate !== dateStr) return;
        setStatus("Couldn't load available times. Please try again in a moment.");
      });
  }

  function selectSlot(iso) {
    selectedSlot = iso;
    markSelected(slotGrid, "slot-btn", iso, "slot");

    var end = new Date(new Date(iso).getTime() + slotMinutes * 60 * 1000).toISOString();
    var summary =
      fmtDay(selectedDate, { weekday: "long", day: "numeric", month: "long" }) +
      " · " + fmtTime(iso, BUSINESS_TZ) + "–" + fmtTime(end, BUSINESS_TZ) + " Israel time";

    var localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (localTz && localTz !== BUSINESS_TZ) {
      summary += " (" + fmtTime(iso, localTz) + " in your time zone)";
    }

    summaryEl.textContent = summary;
    summaryEl.hidden = false;
    submitBtn.disabled = false;
    noteEl.hidden = true;
    errorEl.hidden = true;

    if (form.hidden) {
      form.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  /* -- booking -- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!selectedSlot) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Booking…";

    fetch(API_BASE + "/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        start: selectedSlot,
        notes: form.notes.value.trim() || null,
      }),
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (res) {
        if (res.ok) {
          successWhenEl.textContent = summaryEl.textContent;
          document.querySelector(".booking-picker").hidden = true;
          form.hidden = true;
          successEl.hidden = false;
          successEl.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (res.status === 409) {
          errorEl.textContent = res.data.detail || "That time was just taken — please pick another slot.";
          errorEl.hidden = false;
          /* Reset the slot choice but keep the form (and this error) visible —
             clearSelection() would hide the form and swallow the message. */
          selectedSlot = null;
          summaryEl.hidden = true;
          submitBtn.disabled = true;
          loadSlots(selectedDate);
          errorEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else if (res.status === 429) {
          errorEl.textContent = "Too many booking attempts — please try again later.";
          errorEl.hidden = false;
        } else {
          errorEl.textContent = "Something went wrong booking the meeting. Please try again, or send us a note via the contact page.";
          errorEl.hidden = false;
        }
      })
      .catch(function () {
        errorEl.textContent = "Something went wrong booking the meeting. Please try again, or send us a note via the contact page.";
        errorEl.hidden = false;
      })
      .finally(function () {
        submitBtn.textContent = "Confirm booking";
        if (selectedSlot) submitBtn.disabled = false;
      });
  });

  renderDays();
})();
