const https = require('https');

const urls = [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/2021_Ford_Mustang_Mach-E_First_Edition.jpg/800px-2021_Ford_Mustang_Mach-E_First_Edition.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/2018_Toyota_Camry_%28ASV70R%29_Ascent_sedan_%282018-08-27%29_01.jpg/800px-2018_Toyota_Camry_%28ASV70R%29_Ascent_sedan_%282018-08-27%29_01.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Porsche_992_Carrera_S_front.jpg/800px-Porsche_992_Carrera_S_front.jpg"
];

urls.forEach(url => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        console.log(`Status for ${url}: ${res.statusCode}`);
    }).on('error', e => console.error(e));
});
