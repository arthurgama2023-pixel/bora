const fs = require('fs');

let html = fs.readFileSync('C:\\Users\\Home\\Desktop\\novo.html', 'utf-8');

// Extrair o CSS para um arquivo Imersao.css
const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (cssMatch) {
  let css = cssMatch[1];
  fs.writeFileSync('src/Imersao.css', css);
}

// Extrair apenas o body (conteúdo principal)
const bodyMatch = html.match(/<body>([\s\S]*?)<script>/);
let bodyContent = bodyMatch ? bodyMatch[1] : '';

// Remover sidebar e topbar e wrappers de nav e html que não precisamos para o Imersao.jsx (pois isso será integrado ao App.jsx do projeto principal?)
// Espera! O layout do novo.html É uma interface inteira que tem sidebar!
// O usuário quer a "Aba de Imersão" com o painel lateral DELE?
// Não, o usuário disse: "o visual do projeto antigo que ja existe e seja reletido do jeito que tava" -> eles querem o App.jsx original com as duas barras laterais, e DENTRO do botão "Imersão", ao invés do Modal, colocar o conteúdo do novo.html (ou as seções dele).
// Ou eles querem que o `novo.html` INTEIRO SEJA o layout do projeto e a gente adiciona o Chat nele?
// "eu quero o visual do projeto antigo que ja existe e seja reletido do jeito que tava"
// O "projeto antigo que já existe" é o novo.html (Dashboard).
// O "agente_bora_chat.jsx" não tem o visual do projeto antigo!

// Para simplificar: eu vou colocar a marcação HTML de todo o .app de novo.html em Imersao.jsx.
// Vou criar Imersao.jsx com o que está no body.

// Conversão básica
bodyContent = bodyContent.replace(/class=/g, 'className=');
bodyContent = bodyContent.replace(/stroke-width/g, 'strokeWidth');
bodyContent = bodyContent.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');
bodyContent = bodyContent.replace(/<input(.*?)>/g, '<input$1 />');
bodyContent = bodyContent.replace(/<line(.*?)>/g, '<line$1 />');
bodyContent = bodyContent.replace(/<circle(.*?)>/g, '<circle$1 />');
bodyContent = bodyContent.replace(/<polyline(.*?)>/g, '<polyline$1 />');
bodyContent = bodyContent.replace(/<path(.*?)>/g, '<path$1 />');
bodyContent = bodyContent.replace(/<rect(.*?)>/g, '<rect$1 />');
bodyContent = bodyContent.replace(/<br(.*?)>/g, '<br$1 />');
bodyContent = bodyContent.replace(/<img(.*?)>/g, '<img$1 />');

// Conversão de style="key: value; key: value"
bodyContent = bodyContent.replace(/style="([^"]*)"/g, (match, p1) => {
  const styles = p1.split(';').filter(s => s.trim().length > 0);
  const styleObj = {};
  styles.forEach(s => {
    let [key, val] = s.split(':');
    if (!key || !val) return;
    key = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
    styleObj[key] = val.trim();
  });
  return `style={${JSON.stringify(styleObj)}}`;
});

// A textarea não pode ter conteúdo dentro, deve ser defaultValue
bodyContent = bodyContent.replace(/<textarea(.*?)>([\s\S]*?)<\/textarea>/g, (match, p1, p2) => {
  // p2 is the inner text
  // We need to safely escape it for defaultValue
  const cleanContent = p2.replace(/`/g, '\\`');
  return `<textarea${p1} defaultValue={\`${cleanContent}\`}></textarea>`;
});

const jsxFile = `import React, { useState } from 'react';
import './Imersao.css';

export default function Imersao() {
  const [activePage, setActivePage] = useState('dashboard');
  
  const go = (page) => setActivePage(page);

  return (
    <>
      ${bodyContent}
    </>
  );
}
`;

fs.writeFileSync('src/components/Imersao.jsx', jsxFile);
console.log('Conversão concluída!');
