import { useState } from 'react';
export function ThemeToggle() {
  const [theme,setTheme] = useState(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  return <button className="nf-secondary" type="button" onClick={() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; setTheme(next);
    try { localStorage.setItem('nf_theme',next); } catch {}
  }} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? '☀ Tema claro' : '☾ Tema escuro'}</button>;
}
