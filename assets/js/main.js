(function () {
  "use strict";

  /* Prevent the browser (esp. mobile Chrome bfcache) from reopening the
     page at a stale scroll position — e.g. after a form submit scrolled
     to the bottom. Anchor links (e.g. index.html#approach) still work
     since we only force-reset when there's no hash. */
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  if (!window.location.hash) {
    window.scrollTo(0, 0);
  }
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && !window.location.hash) {
      window.scrollTo(0, 0);
    }
  });

  /* Mobile nav toggle */
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Scroll reveal */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* Contact / demo form -> Formspree (silent submit, no email client) */
  var form = document.getElementById("contact-form") || document.getElementById("demo-form");
  if (form) {
    var formSuccess = document.getElementById("form-success");
    var formNote = document.getElementById("form-note");
    var formError = document.getElementById("form-error");
    var formSubmitBtn = form.querySelector(".form-submit");
    var formSubmitLabel = formSubmitBtn.textContent;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!form.checkValidity()) {
        formSuccess.hidden = true;
        form.reportValidity();
        return;
      }

      formSuccess.hidden = true;
      formError.hidden = true;
      formSubmitBtn.disabled = true;
      formSubmitBtn.textContent = "Sending…";

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { "Accept": "application/json" }
      })
        .then(function (response) {
          if (response.ok) {
            form.reset();
            formNote.hidden = true;
            formSuccess.hidden = false;
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          } else {
            formError.hidden = false;
          }
        })
        .catch(function () {
          formError.hidden = false;
        })
        .finally(function () {
          formSubmitBtn.disabled = false;
          formSubmitBtn.textContent = formSubmitLabel;
        });
    });
  }

  /* Application form -> Formspree (silent submit, includes resume) */
  var appForm = document.getElementById("application-form");
  if (appForm) {
    var appFields = [
      { input: appForm.name, label: "Name" },
      { input: appForm.familyName, label: "Last Name" },
      { input: appForm.email, label: "Email" },
      { input: appForm.linkedin, label: "LinkedIn Profile" },
      {
        input: appForm.resume,
        label: "Resume",
        validate: function (input) {
          if (!input.checkValidity()) {
            return "Resume is required";
          }
          var fileName = input.files[0] ? input.files[0].name : "";
          if (!/\.docx$/i.test(fileName)) {
            return "Only .docx files are accepted";
          }
          return null;
        }
      },
      {
        input: appForm.termsAccepted,
        label: "Terms & Conditions",
        validate: function (input) {
          return input.checked ? null : "You must agree to the Terms & Conditions";
        }
      }
    ];
    var appSuccess = document.getElementById("application-success");
    var appResponseNote = document.getElementById("application-response-note");
    var appError = document.getElementById("application-error");
    var appSubmitBtn = appForm.querySelector(".form-submit");

    appForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var firstInvalid = null;

      appFields.forEach(function (f) {
        var errorEl = document.getElementById(f.input.id + "-error");
        var fieldWrap = f.input.closest(".field");
        var customError = f.validate ? f.validate(f.input) : null;
        var valid = f.validate ? !customError : f.input.checkValidity();

        fieldWrap.classList.toggle("has-error", !valid);
        if (errorEl) {
          errorEl.textContent = valid ? "" : (customError || ("Invalid " + f.label));
        }
        if (!valid && !firstInvalid) {
          firstInvalid = f.input;
        }
      });

      if (firstInvalid) {
        appSuccess.hidden = true;
        appResponseNote.hidden = true;
        appError.hidden = true;
        firstInvalid.focus();
        return;
      }

      appSuccess.hidden = true;
      appResponseNote.hidden = true;
      appError.hidden = true;
      appSubmitBtn.disabled = true;
      appSubmitBtn.textContent = "Sending…";

      fetch(appForm.action, {
        method: "POST",
        body: new FormData(appForm),
        headers: { "Accept": "application/json" }
      })
        .then(function (response) {
          if (response.ok) {
            appForm.reset();
            appSuccess.hidden = false;
            appResponseNote.hidden = false;
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          } else {
            appError.hidden = false;
          }
        })
        .catch(function () {
          appError.hidden = false;
        })
        .finally(function () {
          appSubmitBtn.disabled = false;
          appSubmitBtn.textContent = "Send application";
        });
    });
  }

  /* Footer year */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
