import express from 'express';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(express.urlencoded({ extended: true }));

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

app.get('/profile', (req, res) => {
  res.render('profile.ejs');
});

app.get('/create', (req, res) => {
  res.render('create.ejs');
});

const PORT = 10055;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});