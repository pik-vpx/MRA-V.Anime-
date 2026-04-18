async function test() {
  const res = await fetch('https://anisongdb.com/api/search_request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      and_logic: false,
      ignore_duplicate: true,
      song_name_search_filter: { search: "Mephisto", partial_match: false }
    })
  });
  
  const data = await res.json();
  console.log('All results for "Mephisto":');
  data.forEach(song => {
    console.log(`- ${song.songName} by ${song.songArtist} -> ${song.animeENName}`);
  });
}

test();