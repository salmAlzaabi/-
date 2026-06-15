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
      .setTitle('📖 | Command List')
      .setColor(COLOR)
      .setThumbnail(message.client.user.displayAvatarURL({ extension: 'png' }))
      .addFields(
        {
          name: '🎮 | Games',
          value: [
            `\`${p}roulette\` — Roulette (up to 20 players)`,
            `\`${p}mafia\` — Mafia game`,
            `\`${p}xo\` — Tic-Tac-Toe tournament`,
            `\`${p}rps\` — Rock Paper Scissors tournament`,
            `\`${p}bomb\` — Bomb game`,
            `\`${p}chairs\` — Musical chairs`,
            `\`${p}dice\` — Dice game`,
            `\`${p}hide\` — Hide & Seek`,
            `\`${p}replica\` — Name Animal Plant Object`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '💰 | Points',
          value: [
            `\`${p}points\` — View your points & rank`,
            `\`${p}points @user\` — View another user's points`,
            `\`${p}points top\` — Top 10 leaderboard`,
            `\`${p}points addpoints @user <amount>\` — Add points *(admin)*`,
            `\`${p}points removepoints @user <amount>\` — Remove points *(admin)*`,
            `\`${p}points setpoints @user <amount>\` — Set points *(admin)*`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚙️ | Settings',
          value: [
            `\`${p}setchat\` — Set current channel as game channel`,
            `\`${p}setchat #channel\` — Set specific channel as game channel`,
            `\`${p}removechat\` — Remove current channel from game channels`,
            `\`${p}removechat #channel\` — Remove specific channel`,
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: `Prefix: ${p}  •  Use ${p}help for this menu` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};
