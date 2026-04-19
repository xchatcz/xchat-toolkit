/**
 * Options – entry point React stránky Nastavení.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import OptionsApp from './OptionsApp';
import './options.scss';

const host = document.getElementById('xct-options');
if (host) {
  createRoot(host).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>,
  );
}
