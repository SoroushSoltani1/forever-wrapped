const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors());

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '00f4d8a8c2634a6eb78c5b995349e9e3';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '2b418bbc4e8c432b93bc79493497656b';
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'https://hwxgmc.csb.app/callback';
const PORT = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/callback', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/token', async (req, res) => {
  const { code, code_verifier } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      ...(code_verifier ? { code_verifier } : {}),
    });
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (!code_verifier) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    }
    const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers, body });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  const { time_range = 'medium_term' } = req.query;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [tracksRes, artistsRes, profileRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${time_range}&limit=10`, { headers }),
      fetch(`https://api.spotify.com/v1/me/top/artists?time_range=${time_range}&limit=10`, { headers }),
      fetch('https://api.spotify.com/v1/me', { headers }),
    ]);
    const [tracks, artists, profile] = await Promise.all([
      tracksRes.json(), artistsRes.json(), profileRes.json(),
    ]);
    if (!tracksRes.ok) return res.status(tracksRes.status).json(tracks);
    if (!artistsRes.ok) return res.status(artistsRes.status).json(artists);
    const genreCount = {};
    (artists.items || []).forEach(a => {
      (a.genres || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
    });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    res.json({ tracks: tracks.items || [], artists: artists.items || [], profile, topGenre, timeRange: time_range });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/top-tracks', async (req, res) => {
  const { time_range = 'medium_term', limit = 10 } = req.query;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const r = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${time_range}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    res.status(r.ok ? 200 : r.status).json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/top-artists', async (req, res) => {
  const { time_range = 'medium_term', limit = 10 } = req.query;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const r = await fetch(`https://api.spotify.com/v1/me/top/artists?time_range=${time_range}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    res.status(r.ok ? 200 : r.status).json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const r = await fetch('https://api.spotify.com/v1/me',
      { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    res.status(r.ok ? 200 : r.status).json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`Forever Wrapped running on port ${PORT}`);
});