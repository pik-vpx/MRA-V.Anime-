async function searchAnisongDB(body) {
  const res = await fetch('https://anisongdb.com/api/search_request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function testMatch(title, artist) {
  console.log(`\n=== "${title}" by "${artist}" ===`);
  
  // Pass 1: exact title + exact artist
  let results = await searchAnisongDB({
    and_logic: true,
    ignore_duplicate: true,
    opening_filter: true,
    ending_filter: true,
    insert_filter: true,
    song_name_search_filter: { search: title, partial_match: false },
    artist_search_filter: { search: artist, partial_match: false }
  });
  console.log(`Pass 1 (exact): ${results.length}`);
  
  if (results.length > 0) {
    console.log(`  ✅ ${results[0].songName} -> ${results[0].animeENName} (${results[0].songArtist})`);
    return;
  }
  
  // Pass 2: partial title + partial artist
  results = await searchAnisongDB({
    and_logic: true,
    ignore_duplicate: true,
    opening_filter: true,
    ending_filter: true,
    insert_filter: true,
    song_name_search_filter: { search: title, partial_match: true },
    artist_search_filter: { search: artist, partial_match: true }
  });
  console.log(`Pass 2 (partial): ${results.length}`);
  
  if (results.length > 0) {
    console.log(`  ✅ ${results[0].songName} -> ${results[0].animeENName} (${results[0].songArtist})`);
    return;
  }
  
  // Pass 3: title only
  results = await searchAnisongDB({
    and_logic: false,
    ignore_duplicate: true,
    opening_filter: true,
    ending_filter: true,
    insert_filter: true,
    song_name_search_filter: { search: title, partial_match: true }
  });
  console.log(`Pass 3 (title only): ${results.length}`);
  
  if (results.length > 0) {
    results.forEach((r, i) => console.log(`  ${i+1}. ${r.songName} -> ${r.animeENName} (${r.songArtist})`));
  } else {
    console.log(`  ❌ No results`);
  }
}

// Test 10 songs with different artist info
const tests = [
  { title: "Mephisto", artist: "Queen Bee" },
  { title: "Mephisto", artist: "Ziyoou-vachi" },
  { title: "Idol", artist: "YOASOBI" },
  { title: "Suzume", artist: "RADWIMPS" },
  { title: "Kick Back", artist: "Kenshi Yonezu" },
  { title: "Mixed Nuts", artist: "Official HIGE DANdism" },
  { title: "Specialz", artist: "King Gnu" },
  { title: "Bling Bang Bang Born", artist: "Creepy Nuts" },
  { title: "Inferno", artist: "Mrs. GREEN APPLE" },
  { title: "Gurenge", artist: "LiSA" },
];

(async () => {
  for (const t of tests) {
    await testMatch(t.title, t.artist);
    await new Promise(r => setTimeout(r, 300)); // rate limit
  }
})();