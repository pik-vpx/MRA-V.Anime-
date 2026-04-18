async function test() {
  const testCases = [
    { title: "Mephisto", artist: "Queen Bee" },
    { title: "Mephisto", artist: "" },
  ];

  for (const tc of testCases) {
    console.log(`\n"${tc.title}" by "${tc.artist}"`);
    
    const res = await fetch('https://anisongdb.com/api/search_request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        and_logic: true,
        ignore_duplicate: true,
        song_name_search_filter: { search: tc.title, partial_match: false },
        artist_search_filter: { search: tc.artist, partial_match: false }
      })
    });
    
    const data = await res.json();
    if (data.length > 0) {
      console.log('  ✅ Found:', data[0].animeENName, '-', data[0].songName);
    } else {
      console.log('  ❌ Not found');
    }
  }
}

test();