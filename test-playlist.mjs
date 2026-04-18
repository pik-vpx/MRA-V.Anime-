import { findAnimeForTrack } from './src/lib/api.js';

async function fetchPlaylist() {
  const url = 'https://animethemes.moe/playlist/yjdptp6O';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Playlist fetch failed: ${res.status}`);
  const text = await res.text();
  return text;
}

function parseEntries(text) {
  const entries = [];
  // Capture "Title by Artist OP... • Anime"
  const regex = /([^\n]+?)\s+by\s+([^\n]*?)\s+OP[\d\w-]*\s*•\s*([^\n]+)/gi;
  let match;
  while ((match = regex.exec(text)) && entries.length < 100) {
    const title = match[1].trim();
    const artist = match[2].trim();
    const anime = match[3].trim();
    entries.push({ title, artist, anime });
  }
  return entries;
}

async function runTests() {
  console.log('=== Testing Top 100 Anime Theme Songs from Playlist ===\n');
  const text = await fetchPlaylist();
  const entries = parseEntries(text);
  console.log(`Parsed ${entries.length} entries.`);
  let passed = 0;
  let failed = 0;
  for (const { title, artist, anime } of entries) {
    try {
      const result = await findAnimeForTrack(title, artist);
      if (result && result.length > 0) {
        const first = result[0];
        const hasImage = !!first.imageUrl;
        const correctAnime = first.title.toLowerCase().includes(anime.toLowerCase());
        console.log(`✅ "${title}" by ${artist} → ${first.title} (${first.type}) ${hasImage ? '📷' : '❌'} ${correctAnime ? '👍' : '👎'}`);
        passed++;
      } else {
        console.log(`❌ "${title}" by ${artist} – no match`);
        failed++;
      }
    } catch (e) {
      console.log(`❌ "${title}" by ${artist} – error: ${e.message}`);
      failed++;
    }
    // slight delay to be gentle on API
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}/${entries.length}`);
  console.log(`Failed: ${failed}/${entries.length}`);
  console.log(`Success Rate: ${(passed / entries.length * 100).toFixed(1)}%`);
}

runTests();
