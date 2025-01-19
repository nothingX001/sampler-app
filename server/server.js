const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const xml2js = require('xml2js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Use environment variable or default to 3001
const PORT = process.env.PORT || 3001;

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sampler';
console.log('MongoDB URI:', MONGODB_URI);

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Define Schemas & Models
const SongSchema = new mongoose.Schema({
  videoId: String,
  title: String,
  channel: String,
  genre: String,
  timestamp: { type: Date, default: Date.now },
});

const Song = mongoose.model('Song', SongSchema);

const ChannelSchema = new mongoose.Schema({
  channelId: String,
  name: String,
});

const Channel = mongoose.model('Channel', ChannelSchema);

// Middleware
app.use(cors());
app.use(express.json());

// Seed Default Channels
const DEFAULT_CHANNELS = [
  { channelId: 'UCXxNR5OIs52ZQUDc9RlAing', name: 'Channel 1' },
  { channelId: 'UCY8_y20lxQhhBe8GZl5A9rw', name: 'Channel 2' },
  { channelId: 'UCKydEBEvAU5zkN8o1snt62A', name: 'Channel 3' },
  { channelId: 'UC2CMBX0xUGWdK9SmewrU8B', name: 'Channel 4' },
  { channelId: 'UCg4HwkoSEhqyvk_qwiB5M7g', name: 'Channel 5' },
  { channelId: 'UCbFRFUEgRI64ZogqawRh5Wg', name: 'Channel 6' },
  { channelId: 'UCLcnbgnInVXNeR4mnB6-ScQ', name: 'Channel 7' },
  { channelId: 'UCY8_y20lxQhhBe8GZl5A9rw', name: 'Channel 8' },
  { channelId: 'UC-RVESJTf_zSaFB8qGoxOnA', name: 'Channel 9' },
  { channelId: 'UCZPDvPgP_E1Z-qyMppvJsRQ', name: 'Channel 10' },
  { channelId: 'UCKgYw7coD5LZXGiS-sXnzJQ', name: 'Channel 11' },
  { channelId: 'UC-T9Vf1N9MwW8HttzC_KIaQ', name: 'Channel 12' },
  { channelId: 'UCVBZ9XZcgv0h3dscFWaHNgA', name: 'Channel 13' },
  { channelId: 'UCD3m_nnW8Tma4FIhg56IuIA', name: 'Channel 14' },
  { channelId: 'UCtrJ2-RStj9rX6SOGzv7ybA', name: 'Channel 15' },
];

async function seedDefaultChannels() {
  try {
    console.log('Clearing existing channels...');
    await Channel.deleteMany({}); // Clears all existing channels
    console.log('Seeding default channels...');
    await Channel.insertMany(DEFAULT_CHANNELS);
    console.log('Default channels seeded successfully.');
  } catch (err) {
    console.error('Seeding channels error:', err);
  }
}
seedDefaultChannels();

// Fetch from RSS
app.get('/fetch-from-rss', async (req, res) => {
  try {
    const channels = await Channel.find({});
    const parser = new xml2js.Parser();
    const results = [];

    await Promise.all(
      channels.map(async ({ channelId }) => {
        const rssFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        console.log(`Fetching RSS feed for channel: ${channelId}`);

        const response = await fetch(rssFeedUrl);
        if (!response.ok) {
          console.error(`Failed to fetch RSS feed for channel: ${channelId}, status: ${response.status}`);
          return;
        }

        const rssData = await response.text();
        console.log(`RSS data fetched for channel: ${channelId}`);

        await new Promise((resolve, reject) => {
          parser.parseString(rssData, (err, result) => {
            if (err) {
              console.error(`Failed to parse RSS for channel: ${channelId}`, err);
              return reject(err);
            }
            if (result.feed && result.feed.entry) {
              result.feed.entry.forEach((video) => {
                results.push({
                  videoId: video['yt:videoId'][0],
                  title: video.title[0],
                  channel: video.author[0].name[0],
                });
              });
            } else {
              console.log(`No videos found for channel: ${channelId}`);
            }
            resolve();
          });
        });
      })
    );

    console.log(`Total videos fetched: ${results.length}`);
    try {
      await Song.insertMany(results, { ordered: false });
      console.log('Songs inserted successfully.');
    } catch (insertErr) {
      console.error('Error inserting songs:', insertErr.message);
    }
    res.json({ success: true, added: results.length });
  } catch (error) {
    console.error('Error fetching RSS feeds:', error.message);
    res.status(500).json({ error: 'Failed to fetch videos from RSS feeds' });
  }
});

// Get Random Song
app.get('/random-song', async (req, res) => {
  try {
    const count = await Song.countDocuments();
    if (count === 0) {
      console.log('No songs found in the database.');
      return res.json(null);
    }
    const randomIndex = Math.floor(Math.random() * count);
    const song = await Song.findOne().skip(randomIndex);
    console.log(`Fetched song: ${song.title} from channel: ${song.channel}`);
    res.json(song);
  } catch (error) {
    console.error('Error in /random-song:', error);
    res.status(500).json({ error: 'Failed to fetch a random song' });
  }
});

// Test Database Connectivity Route
app.get('/test-db', async (req, res) => {
  try {
    const channelCount = await Channel.countDocuments();
    const songCount = await Song.countDocuments();
    res.json({ success: true, channelCount, songCount });
  } catch (error) {
    console.error('Error in /test-db:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Root Route
app.get('/', (req, res) => {
  res.send('Welcome to the Sampler App! Try /random-song, /fetch-from-rss, or /upload-audio.');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
