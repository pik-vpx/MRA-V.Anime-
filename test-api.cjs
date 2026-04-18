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

async function fetchAnimeThemesImage(animeName) {
  if (!animeName) return null;

  const nameVariations = [animeName];
  
  if (!/[\u3040-\u30ff\u3400-\u4dbf]/.test(animeName)) {
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&sl=ja&dt=q&q=${encodeURIComponent(animeName)}`);
      const data = await res.json();
      if (data?.[0]?.[0]?.[0]) {
        nameVariations.push(data[0][0][0]);
      }
    } catch (e) {}
  }

  for (const name of nameVariations) {
    try {
      const query = encodeURIComponent(name);

      const searchRes = await fetch(`https://api.animethemes.moe/anime?q=${query}`);
      if (!searchRes.ok) continue;

      const searchData = await searchRes.json();
      const results = searchData.anime;
      if (!results || results.length === 0) continue;

      const normalizedSearch = name.toLowerCase().replace(/\s+/g, ' ').trim();
      
      let bestMatch = results[0];
      
      for (const anime of results) {
        const animeNameLower = (anime.name || '').toLowerCase();
        
        if (animeNameLower === normalizedSearch) {
          bestMatch = anime;
          break;
        }
        if (animeNameLower.includes(normalizedSearch) || normalizedSearch.includes(animeNameLower)) {
          if (!bestMatch || animeNameLower.length < bestMatch.name.length) {
            bestMatch = anime;
          }
        }
      }

      const imgRes = await fetch(`https://api.animethemes.moe/anime?filter[slug]=${bestMatch.slug}&include=images`);
      const imgData = await imgRes.json();

      if (imgData?.data?.[0]?.relationships?.images?.data) {
        const img = imgData.data[0].relationships.images.data.find((i) => i.attributes?.tag === 'logo' || i.attributes?.tag === 'banner');
        if (img) {
          return `https://animethemes.moe${img.attributes.link}`;
        }
      }
    } catch (e) {
      console.log(`  Error with ${name}: ${e.message}`);
    }
  }
  
  return null;
}

async function findAnimeForTrack(rawTitle, rawArtist) {
  const title = cleanQueryTerm(rawTitle);
  const artist = cleanQueryTerm(rawArtist);

  console.log(`Finding anime for: "${title}" by "${artist}"`);

  let results = [];
  try {
    // Pass 1: Exact match on both song title AND artist
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

    // Pass 2: Partial song title AND partial artist
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

    // Pass 3: Partial song title only
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
    return [];
  }

  const animeMap = new Map();

  for (const song of results) {
    const animeName = song.animeENName || song.animeJPName;
    if (!animeName || animeMap.has(animeName)) continue;

    const imageUrl = await fetchAnimeThemesImage(animeName);

    animeMap.set(animeName, {
      title: animeName,
      type: song.songType || 'Unknown',
      url: '',
      imageUrl: imageUrl || ''
    });
  }

  return Array.from(animeMap.values());
}

async function runTests() {
  console.log('=== Testing 20 Anime Songs (API Pipeline) ===\n');
  let passed = 0;
  let failed = 0;

  for (const song of testSongs) {
    try {
      console.log(`\nTesting: "${song.title}" by ${song.artist}`);
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
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      failed++;
    }
  }

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}/20`);
  console.log(`Failed: ${failed}/20`);
  console.log(`Success Rate: ${(passed/20*100).toFixed(1)}%`);
}

runTests();