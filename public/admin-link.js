(function () {
  var ADMIN_URL = "/admin-users.html";
  var ORIGINAL = "+ Novo consultor";
  var LABEL = "+ Novo consultor com senha";

  function isEquipePage() {
    return document.body && document.body.textContent.indexOf("Equipe & Custo/hora") !== -1;
  }

  function isNovoConsultorButton(el) {
    if (!el) return false;
    var button = el.closest && el.closest("button");
    if (!button) return false;
    var text = (button.textContent || "").trim();
    return text === ORIGINAL || text === LABEL;
  }

  function updateButtons() {
    if (!isEquipePage()) return;
    var buttons = document.querySelectorAll("button");
    buttons.forEach(function (button) {
      if ((button.textContent || "").trim() === ORIGINAL) {
        button.textContent = LABEL;
        button.title = "Criar login no Supabase Auth e membro em Equipe";
      }
    });
  }

  document.addEventListener(
    "click",
    function (event) {
      if (!isEquipePage() || !isNovoConsultorButton(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.location.href = ADMIN_URL;
    },
    true
  );

  var observer = new MutationObserver(updateButtons);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateButtons);
  } else {
    updateButtons();
  }
})();
