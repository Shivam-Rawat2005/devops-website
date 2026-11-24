// Loaded in <head> so the saved theme applies before the page paints.
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) { /* storage blocked: follow the system theme */ }
