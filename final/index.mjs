import express from 'express';
import fetch from 'node-fetch';
import mysql from 'mysql2/promise';
import session from 'express-session';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

//initializing sessions
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}))

app.use(express.urlencoded({ extended: true })); // Duplicate url encoded?

const pool = mysql.createPool({
    host: "ethanperegoyprograms.com",
    user: "ethanper_webuser",
    password: "JamesPeregoy1",
    database: "ethanper_music",
    connectionLimit: 10,
    waitForConnections: true
  });
  const conn = await pool.getConnection();

app.use(express.urlencoded({ extended: true })); // Duplicate url encoded?

// GLOBAL VARIABLES
let releases = [];  
let currentIndex = 0;  
let coverArtUrl = null;
let genres = [];

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

app.post('/login', async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    console.log(password);

    let sql = `SELECT *
               FROM user
               WHERE user_name = ? 
               `;
    const [rows] = await conn.query(sql, [username]); 

    if (rows.length > 0) {  //it found at least one record
        const storedPassword = rows[0].user_pass;

        // Compare plain text password with the stored password
        if (password === storedPassword) {
            req.session.userId = rows[0].userId;
            req.session.authenticated = true;
            res.render('home.ejs');
            console.log("login successful")
        } else {
            res.redirect("/login"); // Incorrect password
            console.log("incorrect password")
        }
    } else {
        res.redirect("/login"); // Username not found
        console.log("username not found")
    }
 });

app.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

app.post('/signup', async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    console.log(username);
    console.log(password);

    let sql = `SELECT *
               FROM user
               WHERE user_name = ? 
               `;
    const [rows] = await conn.query(sql, [username]); 

    if (rows.length > 0) {  //it found at least one record
        res.redirect("/signup"); // Username is taken
        console.log("Username is taken")
    } 
    else {
        let sql = `INSERT INTO user (user_name, user_pass)
        VALUES (?, ?)
        `;
        const [query] = await conn.query(sql, [username, password]); 

        res.redirect("/login"); // Account created, move to sign in
        console.log("User credentials added to database")
    }
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

app.post('/add_song_btn', (req, res) => {
    res.redirect('home');
});

// POST route for the "Next" button to load the next release
app.post('/next', async (req, res) => {
    if (currentIndex < releases.length - 1) {
        currentIndex++;  // Move to the next release
        
        // Get the cover art and genres for the next release
        const releaseId = releases[currentIndex].id;
        const coverArtResponse = await fetch(`https://coverartarchive.org/release/${releaseId}`);
        let coverArtUrl = null;
 
        if (coverArtResponse.ok) {
            const coverArtData = await coverArtResponse.json();
            if (coverArtData.images && coverArtData.images.length > 0) {
                coverArtUrl = coverArtData.images[0].image;
            }
        }

        // Get genres for that release 
        const releaseGroupId = releases[currentIndex]['release-group'].id;
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
 
        // Render the search view with the updated release and cover art
        res.render('search', {
            releases,
            genres,
            currentIndex,
            coverArtUrl,
            searchQuery: req.body.search, // Pass the search query as well
            error: null
        });
    } else {
        res.render('search', { releases: null, error: 'No more releases available.' });
    }
 });

app.get('/playlists', async (req, res) => {
    let sql = `SELECT *
                FROM playlist
                WHERE userId = ?`;
    let sqlParams = [req.session.userId];
    const [playlists] = await conn.query(sql, sqlParams)

  res.render('playlists.ejs', {playlists});
});

app.get('/playlist/open', async (req, res) => {
    let playlistId = req.query.playlistId;
    let sql = `SELECT *
                FROM playlist
                WHERE playlistId = ?`;
    let sqlParams = [playlistId];
    const [playlistData] = await conn.query(sql, sqlParams)

    let sql2 = `SELECT *
                FROM playlistCreate
                WHERE playlistId = ?`;
    let sql2Params = [playlistId];
    const [createdSongList] = await conn.query(sql2, sql2Params)
    
    if (createdSongList.length == 0) {
        let createdSongs = [];
        
        let sql = `SELECT *
                FROM playlistSong
                WHERE playlistId = ?`;
        let sqlParams = [playlistId];
        const [songList] = await conn.query(sql, sqlParams)
        if (songList.length == 0) {
            let songs = [];
            res.render('playlist.ejs', {playlistData, createdSongs, songs});
        }
        else {
            let sql = `SELECT *
                    FROM song
                    WHERE `;
            let sqlParams = [];
            for (let i = 0; i < songList.length-1; i++) {
                sql = sql + ` songId = ? OR`;
                sqlParams.push(songList[i].songId)
            }
            sql = sql +  ` songId = ?`;
            sqlParams.push(songList[songList.length-1].songId)

            const [songs] = await conn.query(sql, sqlParams)

            res.render('playlist.ejs', {playlistData, createdSongs, songs});

        }
    }
    else {
        let sql3 = `SELECT *
                    FROM createSong
                    WHERE `;
        let sql3Params = [];
        for (let i = 0; i < createdSongList.length-1; i++) {
            sql3 = sql3 + ` createId = ? OR`;
            sql3Params.push(createdSongList[i].createId)
        }
        sql3 = sql3 +  ` createId = ?`;
        sql3Params.push(createdSongList[createdSongList.length-1].createId)

        const [createdSongs] = await conn.query(sql3, sql3Params)

        let sql = `SELECT *
                FROM playlistSong
                WHERE playlistId = ?`;
        let sqlParams = [playlistId];
        const [songList] = await conn.query(sql, sqlParams)
        if (songList.length == 0) {
            let songs = [];
            res.render('playlist.ejs', {playlistData, createdSongs, songs});
        }
        else {
            let sql = `SELECT *
                    FROM song
                    WHERE `;
            let sqlParams = [];
            for (let i = 0; i < songList.length-1; i++) {
                sql = sql + ` songId = ? OR`;
                sqlParams.push(songList[i].songId)
            }
            sql = sql +  ` songId = ?`;
            sqlParams.push(songList[songList.length-1].songId)

            const [songs] = await conn.query(sql, sqlParams)
            res.render('playlist.ejs', {playlistData, createdSongs, songs});
        }
    }
});

app.get('/profile', async (req, res) => {
    if ( req.session.authenticated){
        let sql = `SELECT *
                FROM user
                WHERE userId = ?`;
        let sqlParams = [req.session.userId];
        const [userData] = await conn.query(sql, sqlParams)
        res.render('profile.ejs', {userData});
    } else {
        res.redirect("/login");
    }
  });

app.get('/create', (req, res) => {
    if ( req.session.authenticated){
        res.render('create.ejs');
    }
    else {
        res.redirect("/login");
    }
});

app.post('/create/new', async(req, res) => {
    let title = req.body.title;
    let artist = req.body.artist;
    let lyrics = req.body.lyrics;
    let genre = req.body.genre;

    let sql =  `INSERT INTO createSong
                (name, artist, lyrics, genre, userId)
                VALUES
                (?,?,?,?,?)`
    let sqlParams = [title,artist,lyrics,genre,req.session.userId];
    const [rows] = await conn.query(sql, sqlParams);

    res.render('create.ejs');
  });

app.get('/create/edit', async(req,res) => {
    let createId = req.query.createId;
    let sql = `SELECT *
                FROM createSong
                WHERE createId = ?`;
    let sqlParams = [createId];
    const [songData] = await conn.query(sql, sqlParams)

    res.render('editCreate.ejs', {songData})
})

app.post('/create/edit', async(req,res) => {
    let createId = req.body.createId;
    let title = req.body.title;
    let artist = req.body.artist;
    let lyrics = req.body.lyrics;
    let genre = req.body.genre;
    
    let sql = `UPDATE  createSong
                SET name = ?,
                    artist = ?,
                    lyrics = ?,
                    genre = ?
                WHERE createId = ?`;
    let sqlParams = [title,artist,lyrics,genre,createId];
    const [songData] = await conn.query(sql, sqlParams)

    let sql2 = `SELECT *
    FROM user
    WHERE userId = ?`;
    let sql2Params = [req.session.userId];
    const [userData] = await conn.query(sql2, sql2Params)

    res.render('profile.ejs', {userData})
})

app.get('/create/view', async(req,res) => {
    let createId = req.query.createId;
    let sql = `SELECT *
                FROM createSong
                WHERE createId = ?`;
    let sqlParams = [createId];
    const [song] = await conn.query(sql, sqlParams);
    
    res.render('createdSong.ejs', {song})
})

app.get('/createdSongs', async(req,res) => {
    let sql = `SELECT *
                FROM createSong
                WHERE userId = ?`;
    let sqlParams = [req.session.userId];
    const [songs] = await conn.query(sql, sqlParams);
    
    res.render('createdSongs.ejs', {songs})
})

app.get('/addSong', async(req,res) => {
    if ( req.session.authenticated){
        let name = req.query.name;
        let artist = req.query.artist;

        let sql = `SELECT *
                FROM playlist
                WHERE userId = ?`;
        let sqlParams = [req.session.userId];
        const [playlists] = await conn.query(sql, sqlParams);
    
        res.render('addSong.ejs', {playlists,name,artist})
    }
    else {
        res.redirect("/login");
    }
})

app.post('/addSong', async(req,res) => {
    if ( req.session.authenticated){
        let name = req.body.name;
        let artist = req.body.artist;
        let playlistId = req.body.playlists;

        let sql= `SELECT *
                    FROM song
                    WHERE name = ? AND artist = ?`;
        let sqlParams = [name,artist];
        const [song] = await conn.query(sql,sqlParams);
        if (song.length == 0) {
            let sql = `INSERT INTO song 
                        (name, artist)
                        VALUES (?, ?)`;
            const [query] = await conn.query(sql, sqlParams); 
            let sql2 = `SELECT *
                    FROM song
                    WHERE name = ? AND artist = ?`;
            let sql2Params = [name,artist];
            const [song] = await conn.query(sql2,sql2Params);

            let sql3 = `INSERT INTO playlistSong
                    (playlistId, songId)
                    VALUES (?, ?)`;
            let sql3Params = [playlistId,song[0].songId]
            const [query2] = await conn.query(sql3, sql3Params)

            res.render('home.ejs');
        }
        else {
            let sql2 = `SELECT *
                    FROM playlistSong
                    WHERE playlistId = ? AND songId = ?`;
            let sql2Params = [playlistId, song[0].songId];
            const [playlistSong] = await conn.query(sql2,sql2Params);
            if (playlistSong.length == 1) {
                console.log ("Song already in playlist");
                res.render('home.ejs')
            }
            else {
                let sql3 = `INSERT INTO playlistSong
                    (playlistId, songId)
                    VALUES (?, ?)`;
                let sql3Params = [playlistId,song[0].songId]
                const [query2] = await conn.query(sql3, sql3Params)
                
                res.render('home.ejs');
            }
        }
    }
    else {
        res.redirect("/login");
    }
})

//Middleware functions
function isAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect("/login");
    }
}

const PORT = 10055;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});