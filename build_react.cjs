const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public', 'novo.html');
const jsxPath = path.join(__dirname, 'src', 'App.jsx');

const html = fs.readFileSync(htmlPath, 'utf8');

// Find start and end of .app
const appStart = html.indexOf('<div class="app">');
const scriptStart = html.indexOf('<script>');
let body = html.substring(appStart + 17, scriptStart);

// Clean up ending divs
body = body.replace(/<\/div>\s*$/g, '');

// Convert HTML to JSX
body = body
  .replace(/class=/g, 'className=')
  .replace(/for=/g, 'htmlFor=')
  .replace(/<input(.*?)>/g, (m, p1) => p1.endsWith('/') ? m : `<input${p1} />`)
  .replace(/<img(.*?)>/g, (m, p1) => p1.endsWith('/') ? m : `<img${p1} />`)
  .replace(/<hr(.*?)>/g, (m, p1) => p1.endsWith('/') ? m : `<hr${p1} />`)
  .replace(/<br(.*?)>/g, (m, p1) => p1.endsWith('/') ? m : `<br${p1} />`)
  .replace(/style="([^"]*)"/g, (match, p1) => {
    const rules = p1.split(';').filter(Boolean);
    const styleObj = {};
    rules.forEach(rule => {
      const parts = rule.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
        const val = parts.slice(1).join(':').trim();
        styleObj[key] = val;
      }
    });
    return `style={${JSON.stringify(styleObj)}}`;
  });

body = body
  .replace(/fill-rule/g, 'fillRule')
  .replace(/clip-rule/g, 'clipRule')
  .replace(/stroke-width/g, 'strokeWidth')
  .replace(/stroke-linecap/g, 'strokeLinecap')
  .replace(/stroke-linejoin/g, 'strokeLinejoin');

// Inject state handlers for tabs
body = body.replace(/className="nav-item active" data-page="dashboard"/, 'className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}');
body = body.replace(/className="nav-item" data-page="mentorados"/, 'className={`nav-item ${activeTab === "mentorados" ? "active" : ""}`} onClick={() => setActiveTab("mentorados")}');
body = body.replace(/className="nav-item" data-page="trilha"/, 'className={`nav-item ${activeTab === "trilha" ? "active" : ""}`} onClick={() => setActiveTab("trilha")}');
body = body.replace(/className="nav-item" data-page="analise"/g, 'className={`nav-item ${activeTab === "analise" ? "active" : ""}`} onClick={() => setActiveTab("analise")}');
body = body.replace(/className="nav-item" data-page="commitments"/, 'className={`nav-item ${activeTab === "commitments" ? "active" : ""}`} onClick={() => setActiveTab("commitments")}');
body = body.replace(/className="nav-item" data-page="alertas"/, 'className={`nav-item ${activeTab === "alertas" ? "active" : ""}`} onClick={() => setActiveTab("alertas")}');

body = body.replace(/className="page active" id="page-dashboard"/, 'className={`page ${activeTab === "dashboard" ? "active" : ""}`} id="page-dashboard"');
body = body.replace(/className="page" id="page-mentorados"/, 'className={`page ${activeTab === "mentorados" ? "active" : ""}`} id="page-mentorados"');
body = body.replace(/className="page" id="page-trilha"/, 'className={`page ${activeTab === "trilha" ? "active" : ""}`} id="page-trilha"');
body = body.replace(/className="page" id="page-perfil"/, 'className={`page ${activeTab === "perfil" ? "active" : ""}`} id="page-perfil"');

body += `
  <section className={\`page \${activeTab === "analise" ? "active" : ""}\`} id="page-analise" style={{padding: 0, height: '100vh', overflow: 'hidden'}}>
      <ChatApp />
  </section>
`;

body = body.replace(/<!--[\s\S]*?-->/g, '');

// A manual fix for <div style={{"margin-top":"18px"... that has invalid key format because of dash
body = body.replace(/"([a-zA-Z]+)-([a-zA-Z]+)"/g, (m, p1, p2) => `"${p1}${p2.toUpperCase()}"`);

const jsx = `
import React, { useState } from 'react';
import ChatApp from './ChatApp';
import './index.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="app">
      ${body}
    </div>
  );
}
`;

fs.writeFileSync(jsxPath, jsx);
console.log("Written App.jsx!");
