const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public', 'novo.html');
const cssPath = path.join(__dirname, 'src', 'index.css');
const jsxPath = path.join(__dirname, 'src', 'App.jsx');

const html = fs.readFileSync(htmlPath, 'utf8');

const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (cssMatch) {
  let css = cssMatch[1];
  fs.writeFileSync(cssPath, css);
}

const bodyMatch = html.match(/<div class="app">([\s\S]*?)<\/div>\s*<\/body>/);
if (bodyMatch) {
  let body = bodyMatch[1]
    .replace(/class=/g, 'className=')
    .replace(/for=/g, 'htmlFor=')
    .replace(/<input(.*?)>/g, '<input$1 />')
    .replace(/<img(.*?)>/g, '<img$1 />')
    .replace(/<hr(.*?)>/g, '<hr$1 />')
    .replace(/<br(.*?)>/g, '<br$1 />')
    .replace(/style="(.*?)"/g, (match, p1) => {
      // Very basic style object conversion
      const rules = p1.split(';').filter(Boolean);
      const styleObj = {};
      rules.forEach(rule => {
        const [key, value] = rule.split(':');
        if(key && value) {
            const camelKey = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
            styleObj[camelKey] = value.trim();
        }
      });
      return `style={${JSON.stringify(styleObj)}}`;
    });

  // Extract the sidebar and main
  const jsx = `
import React, { useState } from 'react';
import ChatApp from './ChatApp';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="app">
      ${body}
    </div>
  );
}
`;
  // We will manually refine this, but let's just dump it first
  // fs.writeFileSync(jsxPath, jsx);
}
