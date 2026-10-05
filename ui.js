// Shared UI: light/dark theme toggle (remembered per browser)
(() => {
  const get = () => { try { return localStorage.getItem('svd_theme'); } catch { return null; } };
  const apply = t => {
    document.documentElement.dataset.theme = t;
    const b = document.getElementById('theme'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  };
  apply(get() || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('theme'); if (!b) return;
    apply(document.documentElement.dataset.theme);
    b.onclick = () => {
      const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(t); try { localStorage.setItem('svd_theme', t); } catch {}
    };
  });
})();
