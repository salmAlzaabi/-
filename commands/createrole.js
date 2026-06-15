const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const COLOR = "#000000";
const ROLE_ABOVE = "1501984358884708465"; // الرتبة اللي تحتها
const ROLE_BELOW = "1515471434003124278"; // الرتبة اللي فوقها

module.exports = {
  name: 'createrole',
  aliases: ['انشاء-رتبة'],
  async execute(message, args) {
    if (!message.member.permissions.has(8n)) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ | You do not have permission.')]
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🏷️ | Role Creator')
      .setDescription('> create a new role.\n> This embed is customized for Soso.')
      .setColor(COLOR)
      .setFooter({ text: 'B3iony Soso' });


    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_role_btn')
        .setLabel('Create Role')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Secondary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    try { await message.delete(); } catch {}
  }
};
