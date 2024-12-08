import express from 'express';
import fetch from 'node-fetch';
import mysql from 'mysql2/promise';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
    host: "ethanperegoyprograms.com",
    user: "ethanper_webuser",
    password: "JamesPeregoy1",
    database: "ethanper_music",
    connectionLimit: 10,
    waitForConnections: true
  });
  const conn = await pool.getConnection();

//GLOBAL VARIABLES
let releases = [];  // Store releases globally to handle pagination
let currentIndex = 0;  // Track the current release being viewed
let coverArtUrl = null;
let genres = [];
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

// GET route for search form
app.get('/search', (req, res) => {
    res.render('search', { releases: null, error: null });
});

// POST route for handling search and displaying results
app.post('/search', async (req, res) => {   

    const searchQuery = req.body.search;
    const searchQueryArtist = req.body.search_artist;

    try {
        // Dynamic API construction
        let apiUrl = `https://musicbrainz.org/ws/2/release/?query=release:${searchQuery} AND status:official&fmt=json`;
        if (searchQueryArtist) {
            apiUrl = `https://musicbrainz.org/ws/2/release/?query=artist:${searchQueryArtist} AND release:${searchQuery} AND status:official&fmt=json`;
        }
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error('Failed to fetch data from the API');
        }

        const data = await response.json();

        // Check if the response contains releases
        if (data.releases && data.releases.length > 0) {
            releases = data.releases;  // Store releases globally
            const releaseId = releases[0].id; // First release ID
            const releaseGroupId = releases[0]['release-group'].id; // Get the release-group ID for genre-fetching
            console.log("releseGroupId:");
            console.log(releaseGroupId);
            // Get genres for that release 
            try {
                const releaseGroupResponse = await fetch(`https://musicbrainz.org/ws/2/release-group/${releaseGroupId}?inc=genres&fmt=json`);
                if (releaseGroupResponse.ok) {
                    const releaseGroupData = await releaseGroupResponse.json();
                    if (releaseGroupData.genres) {
                        genres = releaseGroupData.genres.map(genre => genre.name);
                    }
                }
            } catch (error) {
                console.error('Error fetching genres:', error.message);
            }

            // Get cover art
            const coverArtResponse = await fetch(`https://coverartarchive.org/release/${releaseId}`);
            
            if (coverArtResponse.ok) {
                const coverArtData = await coverArtResponse.json();
                if (coverArtData.images && coverArtData.images.length > 0) {
                    coverArtUrl = coverArtData.images[0].image; // Get the first cover image URL
                }
            }
            
            // Reset to the first release
            currentIndex = 0;  

            // Render the search view with all releases and cover art
            res.render('search', {
                releases, // Pass all releases
                currentIndex, // Start with the first release
                genres, 
                coverArtUrl,
                searchQuery,
                error: null
            }); 
        } else {
            res.render('search', { release: null, error: "No results found. Try another search." });
        }
    } catch (error) {
        console.error(error.message);
        res.render('search', { release: null, error: 'Error fetching release data. Please try again later.' });
    }
});

// POST route for the "Next" button to load the next release
app.post('/next', async (req, res) => {
    if (currentIndex < releases.length - 1) {
        currentIndex++;  // Move to the next release
        
        // Get the cover art for the next release
        const releaseId = releases[currentIndex].id;
        const coverArtResponse = await fetch(`https://coverartarchive.org/release/${releaseId}`);
        let coverArtUrl = null;
 
        if (coverArtResponse.ok) {
            const coverArtData = await coverArtResponse.json();
            if (coverArtData.images && coverArtData.images.length > 0) {
                coverArtUrl = coverArtData.images[0].image;
            }
        }
 
        // Render the search view with the updated release and cover art
        res.render('search', {
            releases,
            currentIndex,
            coverArtUrl,
            searchQuery: req.body.search, // Pass the search query as well
            error: null
        });
    } else {
        res.render('search', { releases: null, error: 'No more releases available.' });
    }
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