#!/usr/bin/env node
// Uso: node server/create-user.js <username> <password>
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

const [,, username, password] = process.argv;
if (!username || !password) {
  console.error('Uso: node server/create-user.js <username> <password>');
  process.exit(1);
}

const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
if (users.find(u => u.username === username)) {
  console.error(`Usuário "${username}" já existe.`);
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
users.push({ username, password: hash });
fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
console.log(`Usuário "${username}" criado com sucesso.`);
