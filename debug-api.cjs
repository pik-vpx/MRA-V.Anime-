async function debug() {
  const body = {
    and_logic: true,
    ignore_duplicate: true,
    opening_filter: true,
    ending_filter: true,
    insert_filter: true,
    song_name_search_filter: { search: "Gurenge", partial_match: false },
    artist_search_filter: { search: "LiSA", partial_match: false }
  };
  
  console.log('Testing AnisongDB with correct body...');
  
  const res = await fetch('https://anisongdb.com/api/search_request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  console.log('Status:', res.status);
  
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

debug();