(function () {
  "use strict";

  
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

  /* Contact form -> mailto fallback (no backend yet) */
  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var company = form.company.value.trim();
      var message = form.message.value.trim();

      var subject = "New inquiry from " + (name || "website");
      var bodyLines = [
        "Name: " + name,
        "Email: " + email,
        "Company: " + (company || "-"),
        "",
        message
      ];

      var mailto =
        "mailto:hello@data-falcon.com" +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(bodyLines.join("\n"));

      window.location.href = mailto;
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
      }
    ];
    var appSuccess = document.getElementById("application-success");
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
        appError.hidden = true;
        firstInvalid.focus();
        return;
      }

      appSuccess.hidden = true;
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
