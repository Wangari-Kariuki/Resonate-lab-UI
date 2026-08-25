const {pool} = require ('pg');

const pool = new Pool ({
    user: 'your_db_user',
    host: 'localhost',
    database: 'your_db_name',
    password: ''
})