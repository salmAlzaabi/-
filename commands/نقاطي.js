const { EmbedBuilder } = require('discord.js');
const db = require('../database.js');

const COLOR = "#d4be78";

module.exports = {
  name: 'نقاطي',
  aliases: ['mypoints', 'mp'],
  execute(message, args) {
    const target = message.mentions.users.first() || message.author;
    const points = db.getUserPoints(target.id);
    const top = db.getTopUsers(100);
    const rank = top.findIndex(([id]) => id === target.id) + 1;

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🎮 | نقاط ${target.username}`)
          .setThumbnail(target.displayAvatarURL({ extension: 'png' }))
          .addFields(
            { name: '💰 النقاط', value: `**${points}** نقطة`, inline: true },
            { name: '🏅 الترتيب', value: rank ? `**#${rank}**` : '—', inline: true },
          )
          .setColor(COLOR)
          .setTimestamp()
      ]
    });
  }
};
