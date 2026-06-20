const bcrypt = require('bcrypt');

const password = 'bora123';
const hash = bcrypt.hashSync(password, 10);
console.log(`Password: ${password}`);
console.log(`Hash: ${hash}`);
