const mapThemes = [
  ["Village Green","Village Consort","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1700007"],
  ["King’s Road","Into The Wilds","Scott Buckley","https://www.scottbuckley.com.au/library/into-the-wilds/"],
  ["Monastery","Agnus Dei X","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100679"],
  ["Castle Gates","Legionnaire (Original)","Scott Buckley","https://www.scottbuckley.com.au/library/legionnaire/"],
  ["Royal Court","Angevin","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1200110"],
  ["Throne Hall","The Descent","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1200094"],
  ["Marsh","Myst on the Moor","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1600007"],
  ["Deep Forest","Hour Of The Witch","Scott Buckley","https://www.scottbuckley.com.au/library/hour-of-the-witch/"],
  ["Mountain Pass","Path Through The Mountains","Scott Buckley","https://www.scottbuckley.com.au/library/path-through-the-mountains/"],
  ["Old Aqueduct","Atlantean Twilight","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100322"],
  ["Birch Grove","Home Was You","Scott Buckley","https://www.scottbuckley.com.au/library/home-was-you/"],
  ["Volcanic Pass","Eyes In The Void","Scott Buckley","https://www.scottbuckley.com.au/library/eyes-in-the-void/"],
  ["Elven Forest","Wildflowers","Scott Buckley","https://www.scottbuckley.com.au/library/wildflowers/"],
  ["City Square","The Britons","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN2600004"],
  ["Fallen City","Undertow","Scott Buckley","https://www.scottbuckley.com.au/library/undertow/"],
  ["Ancient Ruins","Memories Of Stone","Scott Buckley","https://www.scottbuckley.com.au/library/memories-of-stone/"],
  ["Dune Sea","Arid Foothills","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100437"],
  ["Wayside Road","Celtic Impulse","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100297"],
  ["River Bridge","With These Hands","Scott Buckley","https://www.scottbuckley.com.au/library/with-these-hands/"],
  ["Mines","Song Of The Forge","Scott Buckley","https://www.scottbuckley.com.au/library/song-of-the-forge/"],
  ["Cave","Penumbra","Scott Buckley","https://www.scottbuckley.com.au/library/penumbra/"],
  ["Dungeon","Darkest Child","Kevin MacLeod","https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100783"],
] as const;

export function MapSoundtrackCredits() {
  return <>
    <p className="mt-1">Exploration themes are edited into loops under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</p>
    <ul className="mt-1 grid gap-1">
      {mapThemes.map(([name, title, artist, url]) => (
        <li key={name}>{name}: <a className="underline" href={url} target="_blank" rel="noopener noreferrer">{title} by {artist}</a></li>
      ))}
    </ul>
  </>;
}
