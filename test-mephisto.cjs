const testSongs = [
  { title: "Mephisto", artist: "Queens" },
  { title: "Queen Bee", artist: "" },
];

function cleanQueryTerm(term) {
  return term.replace(/[^a-zA-Z0-9\s\u3040-\u30ff\u3400-\u4dbf]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function searchAnisongDB(body) {
  const res = await fetch('https://anisongdb.com/api/search_request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`AnisongDB API error: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function findAnimeForTrack(rawTitle, rawArtist) {
  const title = cleanQueryTerm(rawTitle);
  const artist = cleanQueryTerm(rawArtist);

  console.log(`\nTesting: "${title}" by "${artist}"`);

  let results = [];
  try {
    results = await searchAnisongDB({
      and_logic: true,
      ignore_duplicate: true,
      opening_filter: true,
      ending_filter: true,
      insert_filter: true,
      song_name_search_filter: { search: title, partial_match: false },
      artist_search_filter: { search: artist, partial_match: false }
    });
    console.log('  Pass 1 (exact):', results.length, 'results');

    if (results.length === 0) {
      results = await searchAnisongDB({
        and_logic: true,
        ignore_duplicate: true,
        opening_filter: true,
        ending_filter: true,
        insert_filter: true,
        song_name_search_filter: { search: title, partial_match: true },
        artist_search_filter: { search: artist, partial_match: true }
      });
      console.log('  Pass 2 (partial):', results.length, 'results');
    }

    if (results.length === 0) {
      results = await searchAnisongDB({
        and_logic: false,
        ignore_duplicate: true,
        opening_filter: true,
        ending_filter: true,
        insert_filter: true,
        song_name_search_filter: { search: title, partial_match: true }
      });
      console.log('  Pass 3 (title only):', results.length, 'results');
    }
  } catch (e) {
    console.log('  API Error:', e.message);
    return [];
  }

  if (results.length === 0) {
    console.log('  ❌ No anime found');
    return [];
  }

  console.log('  Results:');
  results.slice(0, 5).forEach((r, i) => {
    console.log(`    ${i+1}. ${r.songName} - ${r.animeENName} (${r.songType})`);
  });

  return results;
}

findAnimeForTrack("Mephisto", "Queens");
findAnimeForTrack("Queen Bee", "");