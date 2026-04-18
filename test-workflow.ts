import { findAnimeForTrack } from './src/lib/api';

const testSongs = [
  { title: "Gurenge", artist: "LiSA" },
  { title: "Unravel", artist: "TK from Ling Tosite Sigure" },
  { title: "Again", artist: "YUI" },
  { title: "Brave Heart", artist: "KOTOKO" },
  { title: "Crossing Field", artist: "LiSA" },
  { title: "Opening Theme", artist: "EGOIST" },
  { title: "Departures", artist: "EGOIST" },
  { title: "The Rumbling", artist: "SiM" },
  { title: "Mixed Nuts", artist: "Official HIGE DANdism" },
  { title: "Suzume", artist: "RADWIMPS" },
  { title: "Idol", artist: "YOASOBI" },
  { title: "Kaibutsu", artist: "YOASOBI" },
  { title: "Specialz", artist: "King Gnu" },
  { title: "Bling-Bang-Bang-Born", artist: "Creepy Nuts" },
  { title: "Merry-Go-Round", artist: "Man with a Mission" },
  { title: "The Perfect World", artist: "MAN WITH A MISSION" },
  { title: "Inferno", artist: "Mrs. GREEN APPLE" },
  { title: "Starlight", artist: "SUEMO" },
  { title: "KICK BACK", artist: "Kenshi Yonezu" },
  { title: "Kick Back", artist: "Kenshi Yonezu" },
];

async function runTests() {
  console.log('=== Testing 20 Anime Songs ===\n');
  let passed = 0;
  let failed = 0;

  for (const song of testSongs) {
    try {
      console.log(`Testing: "${song.title}" by ${song.artist}`);
      const result = await findAnimeForTrack(song.title, song.artist);
      
      if (result && result.length > 0) {
        const first = result[0];
        const hasImage = !!first.imageUrl;
        console.log(`  ✅ Found: ${first.title} (${first.type})`);
        console.log(`     Image: ${hasImage ? '✅ Present' : '❌ Missing'}`);
        if (first.imageUrl) {
          console.log(`     URL: ${first.imageUrl.slice(0, 80)}...`);
        }
        passed++;
      } else {
        console.log(`  ❌ No anime match found`);
        failed++;
      }
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('=== Results ===');
  console.log(`Passed: ${passed}/20`);
  console.log(`Failed: ${failed}/20`);
  console.log(`Success Rate: ${(passed/20*100).toFixed(1)}%`);
}

runTests();