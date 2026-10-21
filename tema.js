// tema.js — Terapkan tema pilihan pengguna SECEpat mungkin (sebelum halaman dirender,
// supaya tidak ada kedip warna). Taruh <script src="tema.js"></script> di dalam <head>.
(function () {
  try {
    var tema = localStorage.getItem("tema-mcaddon") || "default";
    var html = document.documentElement;
    ["gelap", "nether", "end", "emerald"].forEach(function (t) {
      html.classList.remove("tema-" + t);
    });
    if (tema && tema !== "default") html.classList.add("tema-" + tema);
  } catch (e) {}
})();
