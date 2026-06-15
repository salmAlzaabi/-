const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
  async execute(message, args, client) {

    // -points panel
    if (args[0] === 'panel') {
      if (!hasPointsPermission(message.member)) {
        return message.reply({ embeds: [errorEmbed('You do not have permission.')] });
      }

      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setImage(PANEL_IMAGE);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('pts_view')
          .setLabel('Points')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('pts_give')
          .setLabel('Transfer Points')
          .setEmoji('💸')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('pts_top')
          .setLabel('Leaderboard')
          .setEmoji('🏆')
          .setStyle(ButtonStyle.Primary),
      );

      const sent = await message.channel.send({ embeds: [embed], components: [row] });

      const collector = sent.createMessageComponentCollector();

      collector.on('collect', async (i) => {

        // View points
        if (i.customId === 'pts_view') {
          const points = db.getUserPoints(i.user.id);
          const top = db.getTopUsers(100);
          const rank = top.findIndex(([id]) => id === i.user.id) + 1;
          return i.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`🎮 | ${i.user.username}'s Points`)
                .setThumbnail(i.user.displayAvatarURL({ extension: 'png' }))
                .addFields(
                  { name: '💰 Points', value: `**${points}** pts`, inline: true },
                  { name: '🏅 Rank', value: rank ? `**#${rank}**` : '—', inline: true },
                )
                .setColor(COLOR)
                .setTimestamp()
            ],
            ephemeral: true
          });
        }

        // Transfer points - open modal
        if (i.customId === 'pts_give') {
          const modal = new ModalBuilder()
            .setCustomId('pts_give_modal')
            .setTitle('Transfer Points');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('pts_user_id')
                .setLabel('Recipient User ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter user ID...')
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('pts_amount')
                .setLabel('Amount to Transfer')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter amount...')
                .setRequired(true)
            )
          );

          return i.showModal(modal);
        }

        // Leaderboard
        if (i.customId === 'pts_top') {
          const top = db.getTopUsers(10);
          if (!top.length) {
            return i.reply({ embeds: [errorEmbed('No points recorded yet.')], ephemeral: true });
          }
          const medals = ['🥇', '🥈', '🥉'];
          const desc = top.map(([userId, pts], idx) => {
            const medal = medals[idx] || `**${idx + 1}.**`;
            return `${medal} <@${userId}> — **${pts}** pts`;
          }).join('\n');
          return i.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('🏆 | Leaderboard')
                .setDescription(desc)
                .setColor(COLOR)
                .setFooter({ text: 'Top 10 players by points' })
                .setTimestamp()
            ],
            ephemeral: false
          });
        }

        // Modal submit - bank transfer logic
        if (i.customId === 'pts_give_modal') {
          const userId = i.fields.getTextInputValue('pts_user_id').trim();
          const amount = parseInt(i.fields.getTextInputValue('pts_amount').trim());

          if (isNaN(amount) || amount <= 0) {
            return i.reply({ embeds: [errorEmbed('Invalid amount.')], ephemeral: true });
          }

          if (userId === i.user.id) {
            return i.reply({ embeds: [errorEmbed('You cannot transfer points to yourself.')], ephemeral: true });
          }

          let targetUser;
          try {
            targetUser = await i.client.users.fetch(userId);
          } catch {
            return i.reply({ embeds: [errorEmbed('User not found. Make sure the ID is correct.')], ephemeral: true });
          }

          // Check sender balance
          const senderBalance = db.getUserPoints(i.user.id);
          if (senderBalance < amount) {
            return i.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#ff4444')
                  .setTitle('❌ | Insufficient Balance')
                  .addFields(
                    { name: '💰 Your Balance', value: `**${senderBalance}** pts`, inline: true },
                    { name: '💸 Requested', value: `**${amount}** pts`, inline: true },
                    { name: '❗ Missing', value: `**${amount - senderBalance}** pts`, inline: true },
                  )
              ],
              ephemeral: true
            });
          }

          // Deduct from sender, add to receiver
          db.removePoints(i.user.id, amount);
          db.addPoints(targetUser.id, amount);

          const senderNew = db.getUserPoints(i.user.id);
          const receiverNew = db.getUserPoints(targetUser.id);

          return i.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLOR)
                .setTitle('✅ | Transfer Complete')
                .addFields(
                  { name: '👤 From', value: `<@${i.user.id}>`, inline: true },
                  { name: '👤 To', value: `<@${targetUser.id}>`, inline: true },
                  { name: '💸 Amount', value: `**${amount}** pts`, inline: true },
                  { name: '💰 Your New Balance', value: `**${senderNew}** pts`, inline: true },
                  { name: '💰 Their New Balance', value: `**${receiverNew}** pts`, inline: true },
                )
                .setTimestamp()
            ],
            ephemeral: true
          });
        }
      });

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
            .setColor(COLOR)
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
          .setColor(COLOR)
          .setTimestamp()
      ]
    });
  }
};
