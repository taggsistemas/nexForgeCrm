import {ResetPasswordPage} from './features/account-security/ResetPasswordPage';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { MasterPage } from './features/platform/MasterPage';
import './styles.css';
import './features/platform/master.css';
import './nexforge.css';
try { document.documentElement.dataset.theme = localStorage.getItem('nf_theme') === 'light' ? 'light' : 'dark'; } catch {}
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const isMaster = window.location.pathname.replace(/\/+$/, '') === '/taggmaster';
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}>{window.location.pathname==='/reset-password'?<ResetPasswordPage/>:isMaster ? <MasterPage/> : <App/>}</QueryClientProvider></React.StrictMode>);
import './compact.css';
