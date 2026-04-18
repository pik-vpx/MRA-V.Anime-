async function debugImage() {
  const animeName = "Demon Slayer: Kimetsu no Yaiba";
  
  console.log(`Testing AnimeThemes image fetch for: ${animeName}`);
  
  const nameVariations = [animeName];
  
  for (const name of nameVariations) {
    console.log(`\nTrying: ${name}`);
    
    const query = encodeURIComponent(name);
    console.log(`  Search URL: https://api.animethemes.moe/anime?q=${query}`);
    
    const searchRes = await fetch(`https://api.animethemes.moe/anime?q=${query}`);
    console.log(`  Search Status: ${searchRes.status}`);
    
    const searchData = await searchRes.json();
    console.log(`  Search Results: ${JSON.stringify(searchData).slice(0, 500)}`);
    
    if (searchData?.anime?.length > 0) {
      const bestMatch = searchData.anime[0];
      console.log(`  Best match: ${bestMatch.name} (slug: ${bestMatch.slug})`);
      
      const imgRes = await fetch(`https://api.animethemes.moe/anime?filter[slug]=${bestMatch.slug}&include=images`);
      console.log(`  Image Status: ${imgRes.status}`);
      
      const imgData = await imgRes.json();
      console.log(`  Image Data: ${JSON.stringify(imgData).slice(0, 1000)}`);
    }
  }
}

debugImage();