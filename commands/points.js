const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');
const fs = require('fs');

const COLOR = "#d4be78";

const readAdminSettings = () => {
  try {
    return JSON.parse(fs.readFileSync('./admin_settings.json', 'utf8'));
  } catch {
    return { adminRoles: [], eventRoles: [] };
  }
};

const hasAdminPermission = (member) => {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const s = readAdminSettings();
  return member.roles.cache.some(r => [...(s.adminRoles || []), ...(s.eventRoles || [])].includes(r.id));
};

function errorEmbed(msg) {
  return new EmbedBuilder().setColor('#ff4444').setDescription(`❌ | ${msg}`);
}

module.exports = {
  name: 'points',
  aliases: ['pts', 'p'],
  execute(message, args) {
    const sub = args[0];

    if (sub === 'addpoints') {
      if (!hasAdminPermission(message.member)) {
        return message.reply({ embeds: [errorEmbed('You do not have permission to use this command.')] });
      }
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount) || amount <= 0) {
        return message.reply({ embeds: [errorEmbed('Usage: `-points addpoints @user <amount>`')] });
      }
      db.addPoints(target.id, amount);
      const newPoints = db.getUserPoints(target.id);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setDescription(`✅ | Added **${amount}** points to <@${target.id}>\n> **New Balance: ${newPoints} pts**`)
        ]
      });
    }

    if (sub === 'removepoints') {
      if (!hasAdminPermission(message.member)) {
        return message.reply({ embeds: [errorEmbed('You do not have permission to use this command.')] });
      }
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount) || amount <= 0) {
        return message.reply({ embeds: [errorEmbed('Usage: `-points removepoints @user <amount>`')] });
      }
      db.removePoints(target.id, amount);
      const newPoints = db.getUserPoints(target.id);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#ff4444')
            .setDescription(`❌ | Removed **${amount}** points from <@${target.id}>\n> **New Balance: ${newPoints} pts**`)
        ]
      });
    }

    if (sub === 'setpoints') {
      if (!hasAdminPermission(message.member)) {
        return message.reply({ embeds: [errorEmbed('You do not have permission to use this command.')] });
      }
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount) || amount < 0) {
        return message.reply({ embeds: [errorEmbed('Usage: `-points setpoints @user <amount>`')] });
      }
      db.setPoints(target.id, amount);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setDescription(`✅ | Set <@${target.id}>'s points to **${amount} pts**`)
        ]
      });
    }

    if (sub === 'top') {
      const top = db.getTopUsers(10);
      if (!top.length) {
        return message.reply({ embeds: [errorEmbed('No points recorded yet.')] });
      }
      const medals = ['🥇', '🥈', '🥉'];
      const desc = top.map(([userId, pts], i) => {
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} <@${userId}> — **${pts}** pts`;
      }).join('\n');
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🏆 | Leaderboard')
            .setDescription(desc)
            .setColor(COLOR)
            .setFooter({ text: 'Top 10 players by points' })
            .setTimestamp()
        ]
      });
    }

    const target = message.mentions.users.first() || message.author;
    const points = db.getUserPoints(target.id);
    const top = db.getTopUsers(100);
    const rank = top.findIndex(([id]) => id === target.id) + 1;

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🎮 | ${target.username}'s Points`)
          .setThumbnail(target.displayAvatarURL({ extension: 'png' }))
          .addFields(
            { name: '💰 Points', value: `**${points}** pts`, inline: true },
            { name: '🏅 Rank', value: rank ? `**#${rank}**` : '—', inline: true },
          )
          .setColor(COLOR)
          .setTimestamp()
      ]
    });
  }
};
