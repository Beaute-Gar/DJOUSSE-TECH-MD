const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');

const FONT_MAPS = [
  {
    name: '𝔉𝔯𝔞𝔨𝔱𝔲𝔯',
    map: { a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷',A:'𝔄',B:'𝔅',C:'ℭ',D:'𝔇',E:'𝔈',F:'𝔉',G:'𝔊',H:'ℌ',I:'ℑ',J:'𝔍',K:'𝔎',L:'𝔏',M:'𝔐',N:'𝔑',O:'𝔒',P:'𝔓',Q:'𝔔',R:'ℜ',S:'𝔖',T:'𝔗',U:'𝔘',V:'𝔙',W:'𝔚',X:'𝔛',Y:'𝔜',Z:'ℨ' },
  },
  {
    name: '𝕯𝖔𝖚𝖇𝖑𝖊',
    map: { a:'𝕒',b:'𝕓',c:'𝕔',d:'𝕕',e:'𝕖',f:'𝕗',g:'𝕘',h:'𝕙',i:'𝕚',j:'𝕛',k:'𝕜',l:'𝕝',m:'𝕞',n:'𝕟',o:'𝕠',p:'𝕡',q:'𝕢',r:'𝕣',s:'𝕤',t:'𝕥',u:'𝕦',v:'𝕧',w:'𝕨',x:'𝕩',y:'𝕪',z:'𝕫',A:'𝔸',B:'𝔹',C:'ℂ',D:'𝔻',E:'𝔼',F:'𝔽',G:'𝔾',H:'ℍ',I:'𝕀',J:'𝕁',K:'𝕂',L:'𝕃',M:'𝕄',N:'ℕ',O:'𝕆',P:'ℙ',Q:'ℚ',R:'ℝ',S:'𝕊',T:'𝕋',U:'𝕌',V:'𝕍',W:'𝕎',X:'𝕏',Y:'𝕐',Z:'ℤ' },
  },
  {
    name: '𝓢𝓬𝓻𝓲𝓹𝓽',
    map: { a:'𝓪',b:'𝓫',c:'𝓬',d:'𝓭',e:'𝓮',f:'𝓯',g:'𝓰',h:'𝓱',i:'𝓲',j:'𝓳',k:'𝓴',l:'𝓵',m:'𝓶',n:'𝓷',o:'𝓸',p:'𝓹',q:'𝓺',r:'𝓻',s:'𝓼',t:'𝓽',u:'𝓾',v:'𝓿',w:'𝔀',x:'𝔁',y:'𝔂',z:'𝔃',A:'𝓐',B:'𝓑',C:'𝓒',D:'𝓓',E:'𝓔',F:'𝓕',G:'𝓖',H:'𝓗',I:'𝓘',J:'𝓙',K:'𝓚',L:'𝓛',M:'𝓜',N:'𝓝',O:'𝓞',P:'𝓟',Q:'𝓠',R:'𝓡',S:'𝓢',T:'𝓣',U:'𝓤',V:'𝓥',W:'𝓦',X:'𝓧',Y:'𝓨',Z:'𝓩' },
  },
  {
   name: '𝕭𝖔𝖑𝖉',
    map: { a:'á',b:'b',c:'ć',d:'d',e:'é',f:'f',g:'ǵ',h:'h',i:'í',j:'j',k:'ḱ',l:'l',m:'m',n:'ń',o:'ó',p:'p',q:'q',r:'ŕ',s:'ś',t:'t',u:'ú',v:'v',w:'ẃ',x:'x',y:'ý',z:'ź' },
  },
  {
    name: '𝓘𝓽𝓪𝓵𝓲𝓬',
    map: { a:'α',b:'Ь',c:'ç',d:'d',e:'ε',f:'f',g:'g',h:'h',i:'ι',j:'j',k:'κ',l:'l',m:'m',n:'η',o:'σ',p:'ρ',q:'q',r:'r',s:'s',t:'τ',u:'υ',v:'ν',w:'ω',x:'x',y:'γ',z:'z' },
  },
  {
    name: '𝔊𝔬𝔱𝔥𝔦𝔠',
    map: { a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷' },
  },
  {
    name: 'ｻｲﾊﾞｰ',
    map: { a:'ﾑ',b:'ﾑ',c:'ᄃ',d:'ᗪ',e:'乇',f:'ｷ',g:'G',h:'H',i:'ﾉ',j:'J',k:'K',l:'L',m:'ﾶ',n:'刀',o:'O',p:'ｱ',q:'Q',r:'尺',s:'丂',t:'ｲ',u:'u',v:'√',w:'W',x:'ﾒ',y:'Y',z:'乙' },
  },
  {
    name: '.Evaluate',
    map: { a:'₳',b:'฿',c:'₵',d:'₫',e:'€',f:'₣',g:'₲',h:'Ⱨ',i:'ł',j:'J',k:'₭',l:'Ⱡ',m:'₥',n:'₦',o:'Ø',p:'₱',q:'Q',r:'Ɽ',s:'₴',t:'₮',u:'UP',v:'V',w:'₩',x:'Ӿ',y:'Ɏ',z:'Ⱬ' },
  },
  {
    name: 'D̷a̷r̷k̷',
    map: { a:'å',b:'b̊',c:'c̊',d:'ď',e:'é',f:'f̊',g:'g̊',h:'h̊',i:'ï',j:'j̊',k:'k̊',l:'l̊',m:'m̊',n:'ñ',o:'ö',p:'p̊',q:'q̊',r:'r̊',s:'š',t:'ť',u:'ü',v:'v̊',w:'ŵ',x:'x̊',y:'ÿ',z:'ž' },
  },
  {
    name: '욧',
    map: { a:'ﾑ',b:'乃',c:'ᄃ',d:'ᗪ',e:'乇',f:'ｷ',g:'G',h:'H',i:'ﾉ',j:'J',k:'K',l:'L',m:'ﾶ',n:'刀',o:'O',p:'ｱ',q:'Q',r:'尺',s:'丂',t:'ｲ',u:'u',v:'√',w:'W',x:'ﾒ',y:'Y',z:'乙' },
  },
  {
    name: '룻',
    map: { a:'₳',b:'฿',c:'₵',d:'₫',e:'€',f:'₣',g:'₲',h:'Ⱨ',i:'ł',j:'J',k:'₭',l:'Ⱡ',m:'₥',n:'₦',o:'Ø',p:'₱',q:'Q',r:'Ɽ',s:'₴',t:'₮',u:'UP',v:'V',w:'₩',x:'Ӿ',y:'Ɏ',z:'Ⱬ' },
  },
  {
    name: 'ᗧ',
    map: { a:'ᐸ',b:'ᗺ',c:'ᑢ',d:'ᗡ',e:'Ǝ',f:'ᖴ',g:'ᑂ',h:'ᕼ',i:'ᑄ',j:'ᒉ',k:'ᗽ',l:'ᒪ',m:'ᗰ',n:'ヮ',o:'ᑫ',p:'ᑶ',q:'ᑴ',r:'ᖇ',s:'\Component',t:'ᑕ',u:'ᑘ',v:'ᐺ',w:'ᘁ',x:'᙭',y:'ᖻ',z:'ᗭ' },
  },
];

function convert(text, fontMap) {
  return text.split('').map(ch => fontMap[ch] || ch).join('');
}

function toFancy(text) {
  return FONT_MAPS.filter(f => f.name).map(f => {
    const converted = convert(text, f.map);
    return `*${f.name}*\n${converted}`;
  });
}

cmd({
  pattern: 'fancy',
  alias: ['style'],
  desc: 'Convert text to fancy Unicode fonts',
  category: 'tools',
  filename: __filename,
}, async (conn, m, args, { reply }) => {
  const text = args.join(' ').trim();
  if (!text) {
    return conn.sendMessage(m.key.remoteJid, {
      text: boxWithFooter('✨ Fancy Text', [{ raw: 'Provide text to convert.\nUsage: .fancy <text>' }]),
    }, { quoted: m });
  }

  const variations = toFancy(text);
  const lines = [];
  for (const v of variations) {
    lines.push({ raw: v });
    lines.push({ blank: true });
  }

  await conn.sendMessage(m.key.remoteJid, {
    text: boxWithFooter('✨ Fancy Text Generator', lines),
  }, { quoted: m });
});
