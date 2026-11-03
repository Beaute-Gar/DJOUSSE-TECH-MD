'use strict';

const axios = require('axios');
const style = require('../../config/style');
const { getStr } = require('../_partage/theme');

function formatNumber(value) {
  if (value === undefined || value === null) return 'N/A';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function statBar(value, max, length = 12) {
  if (!max) return '▱'.repeat(length);
  const filled = Math.round((value / max) * length);
  return '▰'.repeat(Math.min(filled, length)) + '▱'.repeat(Math.max(length - filled, 0));
}

module.exports = {
  commands: ['tiktokstalk', 'ttstalk', 'tksearch', 'ttuser', 'tikstalk'],
  description: 'Stalk a TikTok profile — followers, videos, likes, bio and more',
  usage: '.tiktokstalk <username>',
  permission: 'public',
  group: true,
  private: true,

  run: async (sock, message, args, { jid, contextInfo, reply }) => {
    const username = args[0]?.replace(/^@/, '').trim();
    if (!username) {
      return reply(style.renderSaisie('Please provide a TikTok username. Example: .ttstalk charlidamelio'));
    }

    await sock.sendPresenceUpdate('composing', jid);
    await sock.sendMessage(jid, {
      text: style.renderInfo([`Fetching TikTok profile for @${username}…`]),
      contextInfo,
    }, { quoted: message });

    let userData = null;
    try {
      const { data } = await axios.get(
        `https://tikwm.com/api/user/info?unique_id=${encodeURIComponent(username)}`,
        {
          timeout: 12000,
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        }
      );
      if (data?.code !== 0) throw new Error(data?.msg || 'TikWM error');
      userData = data.data?.user || null;
    } catch (error) {
      console.warn(`[TikTokStalk] TikWM: ${error.message}`);
    }

    if (!userData) {
      return reply(style.renderError([`TikTok user @${username} not found or profile is private.`]));
    }

    const user = userData;
    const followers = user.fans ?? user.followerCount ?? 0;
    const following = user.following ?? user.followingCount ?? 0;
    const likes = user.heart ?? user.heartCount ?? user.digg_count ?? 0;
    const videos = user.video ?? user.videoCount ?? 0;
    const friends = user.friend ?? user.friendCount ?? 0;
    const maxValue = Math.max(followers, likes, 1);
    const badges = [];

    if (user.verified) badges.push('✅ Verified');
    if (user.privateAccount) badges.push('🔒 Private account');
    if (user.isUnderAge18) badges.push('🔞 Under 18');
    if (user.openFavorite) badges.push('⭐ Favorites public');
    if (user.commentSetting === 1) badges.push('💬 Comments: Friends only');
    if (user.commentSetting === 2) badges.push('💬 Comments: Off');
    if (!user.verified && followers > 1_000_000) badges.push('🚀 1M+ unverified mega creator');

    const region = user.region || user.country || null;
    const lines = [
      '🎵 TikTok Profile Report',
      '',
      '🆔 Identity',
      `• Username: @${user.uniqueId || username}`,
    ];

    if (user.nickname) lines.push(`• Display Name: ${user.nickname}`);
    if (user.id) lines.push(`• User ID: ${user.id}`);
    if (region) lines.push(`• Region: ${region}`);
    if (user.language) lines.push(`• Language: ${user.language}`);

    if (user.signature) {
      lines.push('', '📝 Bio', user.signature.slice(0, 300));
    }

    lines.push(
      '',
      '📊 Stats',
      `• Followers: ${formatNumber(followers)}  ${statBar(followers, maxValue)}`,
      `• Following: ${formatNumber(following)}`
    );
    if (friends) lines.push(`• Friends: ${formatNumber(friends)}`);
    lines.push(
      `• Likes (total received): ❤️ ${formatNumber(likes)}  ${statBar(likes, maxValue)}`,
      `• Videos posted: 🎬 ${formatNumber(videos)}`
    );
    if (followers && videos) {
      lines.push(`• Avg likes/video: ~${formatNumber(Math.round(likes / videos))}`);
    }

    lines.push(
      '',
      '⚙️ Account Settings',
      `• Private: ${user.privateAccount ? '🔒 Yes' : '🔓 No'}`,
      `• Duet: ${user.duetSetting === 0 ? '✅ Open' : user.duetSetting === 1 ? '👥 Friends' : '❌ Off'}`,
      `• Stitch: ${user.stitchSetting === 0 ? '✅ Open' : user.stitchSetting === 1 ? '👥 Friends' : '❌ Off'}`,
      `• Comment: ${user.commentSetting === 0 ? '✅ Everyone' : user.commentSetting === 1 ? '👥 Friends' : '❌ Off'}`
    );

    if (badges.length) lines.push('', '🏷️ Badges', ...badges.map(badge => `• ${badge}`));
    lines.push(
      '',
      `• Profile: https://www.tiktok.com/@${user.uniqueId || username}`,
      `_Powered by ${getStr('botName') || 'DJOUSSE TECH'} · TikWM API_`
    );

    const text = style.renderInfo(lines);
    const avatarUrl = user.avatarLarger || user.avatarThumb || user.avatar || null;
    try {
      if (avatarUrl) {
        await sock.sendMessage(jid, {
          image: { url: avatarUrl },
          caption: text,
          contextInfo,
        }, { quoted: message });
      } else {
        await reply(text);
      }
    } catch {
      await reply(text);
    }

    await sock.sendPresenceUpdate('paused', jid);
  },
};
