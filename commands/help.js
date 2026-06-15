const { EmbedBuilder } = require('discord.js');
const fs = require('fs');

const COLOR = "#d4be78";

const getPrefix = () => {
  try {
    return JSON.parse(fs.readFileSync('./admin_settings.json', 'utf8')).prefix || '-';
  } catch {
    return '-';
  }
};

module.exports = {
  name: 'help',
  aliases: ['h', 'commands'],
  execute(message, args) {
    const p = getPrefix();

    const embed = new EmbedBuilder()
      .setTitle('📖 | قائمة الأوامر')
      .setColor(COLOR)
      .setThumbnail(message.client.user.displayAvatarURL({ extension: 'png' }))
      .addFields(
        {
          name: '🎮 | الألعاب',
          value: [
            `\`${p}roulette\` — روليت (حتى 20 لاعب)`,
            `\`${p}mafia\` — لعبة المافيا`,
            `\`${p}xo\` — إكس أو`,
            `\`${p}rps\` — حجرة ورقة مقص`,
            `\`${p}bomb\` — لعبة القنبلة`,
            `\`${p}chairs\` — الكراسي الموسيقية`,
            `\`${p}dice\` — لعبة النرد`,
            `\`${p}hide\` — الغميضة`,
            `\`${p}replica\` — نبات جماد حيوان`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '💰 | النقاط',
          value: [
            `\`${p}points\` — عرض نقاطك وترتيبك`,
            `\`${p}points @مستخدم\` — عرض نقاط شخص آخر`,
            `\`${p}points top\` — لوحة أعلى 10 لاعبين`,
            `\`${p}points addpoints @مستخدم <عدد>\` — إضافة نقاط *(مسؤول)*`,
            `\`${p}points removepoints @مستخدم <عدد>\` — خصم نقاط *(مسؤول)*`,
            `\`${p}points setpoints @مستخدم <عدد>\` — تعيين نقاط *(مسؤول)*`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚙️ | الإعدادات',
          value: [
            `\`${p}setchat\` — تعيين القناة الحالية لقناة ألعاب`,
            `\`${p}setchat #قناة\` — تعيين قناة محددة`,
            `\`${p}removechat\` — إزالة القناة الحالية`,
            `\`${p}removechat #قناة\` — إزالة قناة محددة`,
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: `البادئة: ${p}  •  اكتب ${p}help لعرض هذه القائمة` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};
