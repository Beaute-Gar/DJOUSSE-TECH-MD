import axios from 'axios';
import config from '../config.cjs';

const imdb = async (m, gss) => {
  try {
    const prefix = config.PREFIX;
const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
const text = m.body.slice(prefix.length + cmd.length).trim();

    const validCommands = ['movie'];

    if (!validCommands.includes(cmd)) return;

    if (!text) return m.reply('Give me a series or movie name');

    let fids = await axios.get(`http://www.omdbapi.com/?apikey=742b2d09&t=${encodeURIComponent(text)}&plot=full`);
    let imdbt = "";
    
    if (fids.data.Response === "False") {
      return m.reply('Movie or series not found');
    }

    imdbt += "âšâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâš\n";
    imdbt += " ```*ðŸš€ DJOUSSE-TECH-MD MOVIES*```\n";
    imdbt += "âšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽâšŽ\n";
    imdbt += `ðŸŽ¬Title      : ${fids.data.Title}\n`;
    imdbt += `ðŸ“…Year       : ${fids.data.Year}\n`;
    imdbt += `â­Rated      : ${fids.data.Rated}\n`;
    imdbt += `ðŸ“†Released   : ${fids.data.Released}\n`;
    imdbt += `â³Runtime    : ${fids.data.Runtime}\n`;
    imdbt += `ðŸŒ€Genre      : ${fids.data.Genre}\n`;
    imdbt += `ðŸ‘¨ðŸ»â€ðŸ’»Director   : ${fids.data.Director}\n`;
    imdbt += `âœWriter     : ${fids.data.Writer}\n`;
    imdbt += `ðŸ‘¨Actors     : ${fids.data.Actors}\n`;
    imdbt += `ðŸ“ƒPlot       : ${fids.data.Plot}\n`;
    imdbt += `ðŸŒLanguage   : ${fids.data.Language}\n`;
    imdbt += `ðŸŒCountry    : ${fids.data.Country}\n`;
    imdbt += `ðŸŽ–ï¸Awards     : ${fids.data.Awards}\n`;
    imdbt += `ðŸ“¦BoxOffice  : ${fids.data.BoxOffice}\n`;
    imdbt += `ðŸ™ï¸Production : ${fids.data.Production}\n`;
    imdbt += `ðŸŒŸimdbRating : ${fids.data.imdbRating}\n`;
    imdbt += `âœ…imdbVotes  : ${fids.data.imdbVotes}\n`;

    await gss.sendMessage(m.from, {
      image: {
        url: fids.data.Poster,
      },
      caption: imdbt,
    }, {
      quoted: m,
    });
  } catch (error) {
    console.error('Error:', error);
    m.reply('An error occurred while fetching the data.');
  }
};

export default imdb;
      

