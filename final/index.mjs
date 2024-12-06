import express from 'express';
import mysql from 'mysql2/promise';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

const pool = mysql.createPool({
  host: "ethanperegoyprograms.com",
  user: "ethanper_webuser",
  password: "JamesPeregoy1",
  database: "ethanper_music",
  connectionLimit: 10,
  waitForConnections: true
});
const conn = await pool.getConnection();

app.use(express.urlencoded({ extended: true }));


let userId = 1;

// Routes
app.get('/', (req, res) => {
  res.redirect('/home');
});

app.get('/home', (req, res) => {
  res.render('home.ejs');
});

app.get('/login', (req, res) => {
  res.render('login.ejs');
});

app.get('/search', (req, res) => {
  res.render('search.ejs');
});

app.get('/playlist', (req, res) => {
  res.render('playlist.ejs');
});

app.get('/profile', async (req, res) => {
  let sql = `SELECT *
              FROM user
              WHERE userId = ?`;
  let sqlParams = [userId];
  const [userData] = await conn.query(sql, sqlParams)
  res.render('profile.ejs', {userData});
});

app.get('/create', (req, res) => {
  res.render('create.ejs');
});

const PORT = 10055;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});