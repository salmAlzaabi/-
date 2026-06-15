const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database.js');

const COLOR = "#d4be78";
const POINTS_ROLE = "1501984311115776131";
const PANEL_IMAGE = "https://cdn.discordapp.com/attachments/1500844249736937602/1515745446071504926/1195827812565798953.png?ex=6a30c833&is=6a2f76b3&hm=be997556330c2d498c2c07dfe1a9bf7799d1e6a6f379c50b55ac5a327ff61be3&animated=true";

const hasPointsPermission = (member) => {
  if (member.permissions.has(8n)) return true;
  return member.roles.cache.has(POINTS_ROLE);
};

function errorEmbed(msg) {
  return new EmbedBuilder().setColor('#ff4444').setDescription(`❌ | ${msg}`);
}

module.exports = {
  name: 'points',
  aliases: ['نقاط'],
  async execute(message, args) {

    // -points panel
    if (args[0] === 'panel') {
      if (!hasPointsPermission(message.member)) {
        return message.reply({ embeds: [errorEmbed('You do not have permission.')] });
      }

      const embed = new EmbedBuilder()
        .setTitle('⬛ Points System')
        .setColor('#000000')
        .setImage(PANEL_IMAGE)
        .setFooter({ text: 'B3iony Soso' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('pts_view')
          .setLabel('My Points')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('pts_give')
          .setLabel('Transfer')
          .setEmoji('💸')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('pts_top')
          .setLabel('Leaderboard')
          .setEmoji('🏆')
          .setStyle(ButtonStyle.Secondary),
      );

      await message.channel.send({ embeds: [embed], components: [row] });
      try { await message.delete(); } catch {}
      return;
    }

    // -points top
    if (args[0] === 'top') {
      const top = db.getTopUsers(10);
      if (!top.length) return message.reply({ embeds: [errorEmbed('No points recorded yet.')] });
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
            .setColor('#000000')
            .setFooter({ text: 'Top 10 players by points' })
            .setTimestamp()
        ]
      });
    }

    // -points addpoints @user amount
    if (args[0] === 'addpoints') {
      if (!hasPointsPermission(message.member)) return message.reply({ embeds: [errorEmbed('No permission.')] });
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount) || amount <= 0) return message.reply({ embeds: [errorEmbed('Usage: `-points addpoints @user <amount>`')] });
      db.addPoints(target.id, amount);
      const newPoints = db.getUserPoints(target.id);
      return message.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setDescription(`✅ | Added **${amount}** pts to <@${target.id}> | Balance: **${newPoints}**`)] });
    }

    // -points removepoints @user amount
    if (args[0] === 'removepoints') {
      if (!hasPointsPermission(message.member)) return message.reply({ embeds: [errorEmbed('No permission.')] });
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount) || amount <= 0) return message.reply({ embeds: [errorEmbed('Usage: `-points removepoints @user <amount>`')] });
      db.removePoints(target.id, amount);
      const newPoints = db.getUserPoints(target.id);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription(`❌ | Removed **${amount}** pts from <@${target.id}> | Balance: **${newPoints}**`)] });
    }

    // -points setpoints @user amount
    if (args[0] === 'setpoints') {
      if (!hasPointsPermission(message.member)) return message.reply({ embeds: [errorEmbed('No permission.')] });
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount) || amount < 0) return message.reply({ embeds: [errorEmbed('Usage: `-points setpoints @user <amount>`')] });
      db.setPoints(target.id, amount);
      return message.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setDescription(`✅ | Set <@${target.id}>'s points to **${amount}**`)] });
    }

    // -points / -points @user
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
          .setColor('#000000')
          .setTimestamp()
      ]
    });
  }
};
